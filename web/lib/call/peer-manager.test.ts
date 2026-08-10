import { describe, expect, it, vi } from "vitest";
import { PeerManager, type PeerManagerOptions } from "./peer-manager";
import type { CallRtcPayload } from "./types";

// ---- Mock WebRTC primitives ------------------------------------------------

class MockPeerConnection {
  static instances: MockPeerConnection[] = [];

  signalingState: RTCSignalingState = "stable";
  connectionState: RTCPeerConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  setLocalCalls: RTCSessionDescriptionInit[] = [];
  iceCandidates: RTCIceCandidateInit[] = [];
  addTrackCalls: Array<{ track: MediaStreamTrack; stream: MediaStream }> = [];
  closed = false;
  sender: { track: MediaStreamTrack | null; replaceTrack: ReturnType<typeof vi.fn> };

  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null = null;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  constructor(_config?: RTCConfiguration) {
    this.sender = {
      track: { kind: "video" } as MediaStreamTrack,
      replaceTrack: vi.fn(async () => {}),
    };
    MockPeerConnection.instances.push(this);
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.addTrackCalls.push({ track, stream });
    return {} as RTCRtpSender;
  }

  async createOffer() {
    return { type: "offer" as const, sdp: `offer-${MockPeerConnection.instances.indexOf(this)}` };
  }

  async createAnswer() {
    return { type: "answer" as const, sdp: `answer-${MockPeerConnection.instances.indexOf(this)}` };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.setLocalCalls.push(description);
    this.localDescription = description;
    if (description.type === "offer") this.signalingState = "have-local-offer";
    else if (description.type === "answer") this.signalingState = "stable";
    else if (description.type === "rollback") this.signalingState = "stable";
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
    if (description.type === "offer") this.signalingState = "have-remote-offer";
    else if (description.type === "answer") this.signalingState = "stable";
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    this.iceCandidates.push(candidate);
  }

  close() {
    this.closed = true;
    this.connectionState = "closed";
  }

  getSenders() {
    return [this.sender] as unknown as RTCRtpSender[];
  }

  getReceivers() {
    return [];
  }
}

const fakeTrack = (kind: string) =>
  ({ kind, enabled: true }) as unknown as MediaStreamTrack;
const localStream = {
  getTracks: () => [fakeTrack("video"), fakeTrack("audio")],
} as unknown as MediaStream;
const remoteStream = { id: "remote-stream" } as unknown as MediaStream;

// ---- Harness ----------------------------------------------------------------

function makeManager(
  myId: string,
  outbound: CallRtcPayload[],
  overrides: Partial<PeerManagerOptions> = {},
) {
  return new PeerManager({
    getLocalStream: () => localStream,
    getMyId: () => myId,
    publishRtc: (payload) => outbound.push(payload),
    onRemoteStream: vi.fn(),
    onPeerRemoved: vi.fn(),
    peerFactory: () => new MockPeerConnection() as unknown as RTCPeerConnection,
    ...overrides,
  });
}

function resetInstances() {
  MockPeerConnection.instances.length = 0;
}

/** Downcasts a PeerManager's RTCPeerConnection handle to the mock class. */
function mockOf(pc: RTCPeerConnection): MockPeerConnection {
  return pc as unknown as MockPeerConnection;
}

describe("PeerManager two-peer signaling", () => {
  it("completes a full offer/answer/ICE handshake between two peers", async () => {
    resetInstances();
    const outA: CallRtcPayload[] = [];
    const outB: CallRtcPayload[] = [];
    const managerA = makeManager("A", outA);
    const managerB = makeManager("B", outB);

    // A initiates: offer -> B.
    await managerA.connectToPeer("B");
    expect(outA).toHaveLength(1);
    expect(outA[0]).toMatchObject({ type: "offer", to: "B" });

    // B answers: answer -> A.
    await managerB.handleSignal("A", outA[0]);
    expect(outB).toHaveLength(1);
    expect(outB[0]).toMatchObject({ type: "answer", to: "A" });

    // A applies the answer.
    await managerA.handleSignal("B", outB[0]);

    const pcA = managerA.getPeer("B");
    const pcB = managerB.getPeer("A");
    expect(pcA).not.toBeNull();
    expect(pcB).not.toBeNull();
    // A saw B's answer; B saw A's offer; both stable.
    expect((pcA!.remoteDescription as RTCSessionDescriptionInit).type).toBe("answer");
    expect((pcB!.remoteDescription as RTCSessionDescriptionInit).type).toBe("offer");
    expect(pcA!.signalingState).toBe("stable");
    expect(pcB!.signalingState).toBe("stable");

    // ICE: A emits a candidate for B; B applies it.
    mockOf(pcA!).onicecandidate!({
      candidate: { toJSON: () => ({ candidate: "cand-1", sdpMid: "0" }) } as unknown as RTCIceCandidate,
    } as unknown as RTCPeerConnectionIceEvent);
    expect(outA).toHaveLength(2);
    await managerB.handleSignal("A", outA[1]);
    expect(mockOf(pcB!).iceCandidates).toContainEqual({ candidate: "cand-1", sdpMid: "0" });

    // Remote tracks flow to the component callback.
    const onRemoteStreamB = vi.fn();
    const managerWithCallback = makeManager("B", [], { onRemoteStream: onRemoteStreamB });
    await managerWithCallback.handleSignal("A", outA[0]);
    const pcWithCallback = managerWithCallback.getPeer("A")!;
    mockOf(pcWithCallback).ontrack!({ streams: [remoteStream] });
    expect(onRemoteStreamB).toHaveBeenCalledWith("A", remoteStream);
  });

  it("ignores signals addressed to a different peer", async () => {
    resetInstances();
    const outA: CallRtcPayload[] = [];
    const managerA = makeManager("A", outA);
    await managerA.handleSignal("B", { type: "ice", to: "C", data: { candidate: "x" } });
    expect(managerA.peerIds()).toEqual([]);
  });

  it("handles glare: rolls back its own offer before accepting an incoming offer", async () => {
    resetInstances();
    const outA: CallRtcPayload[] = [];
    const outB: CallRtcPayload[] = [];
    const managerA = makeManager("A", outA);
    const managerB = makeManager("B", outB);

    // Both sides fire offers at the same time (no relay — capture only).
    await managerA.connectToPeer("B");
    await managerB.connectToPeer("A");
    expect(outA).toHaveLength(1);
    expect(outB).toHaveLength(1);

    // Deliver B's offer to A while A still has a local offer.
    await managerA.handleSignal("B", outB[0]);
    const pcA = mockOf(managerA.getPeer("B")!);
    expect(pcA.setLocalCalls.some((call) => call.type === "rollback")).toBe(true);
    expect(pcA.remoteDescription?.type).toBe("offer");

    // Deliver A's offer to B; B rolls back too, answers A.
    await managerB.handleSignal("A", outA[0]);
    const pcB = mockOf(managerB.getPeer("A")!);
    expect(pcB.setLocalCalls.some((call) => call.type === "rollback")).toBe(true);

    // B's answer resolves A to stable. outB is [offer, answer] — deliver the answer.
    expect(outB).toHaveLength(2);
    await managerA.handleSignal("B", outB[1]);
    expect(pcA.signalingState).toBe("stable");
  });

  it("removes a peer and notifies when its connection fails", async () => {
    resetInstances();
    const outA: CallRtcPayload[] = [];
    const managerA = makeManager("A", outA);
    const onPeerRemoved = vi.fn();
    const managerWithCallback = makeManager("A", outA, { onPeerRemoved });

    await managerWithCallback.connectToPeer("B");
    const pc = mockOf(managerWithCallback.getPeer("B")!);
    pc.connectionState = "failed";
    pc.onconnectionstatechange?.();

    expect(managerWithCallback.peerIds()).toEqual([]);
    expect(onPeerRemoved).toHaveBeenCalledWith("B");
  });

  it("replaces the video track sent to every peer (screen share)", async () => {
    resetInstances();
    const outA: CallRtcPayload[] = [];
    const managerA = makeManager("A", outA);
    await managerA.connectToPeer("B");
    const pc = mockOf(managerA.getPeer("B")!);
    const screenTrack = fakeTrack("video");

    await managerA.replaceVideoTrack(screenTrack);
    expect(pc.sender.replaceTrack).toHaveBeenCalledWith(screenTrack);
  });

  it("closes every peer on leave", async () => {
    resetInstances();
    const outA: CallRtcPayload[] = [];
    const outB: CallRtcPayload[] = [];
    const managerA = makeManager("A", outA);
    const managerB = makeManager("B", outB);
    await managerA.connectToPeer("B");
    await managerB.handleSignal("A", outA[0]);

    const pcA = mockOf(managerA.getPeer("B")!);
    const pcB = mockOf(managerB.getPeer("A")!);

    managerA.closeAll();
    expect(pcA.closed).toBe(true);
    expect(managerA.peerIds()).toEqual([]);
    expect(pcB.closed).toBe(false); // other side's connection survives its own manager
  });
});
