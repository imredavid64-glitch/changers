import type { CallRtcPayload } from "./types";

/**
 * Owns the RTCPeerConnection lifecycle for one call: creating peers, the
 * offer/answer/ICE handshake (with glare handling), and teardown. The
 * component supplies its media stream, identity, and state callbacks via
 * options so the class is fully testable with a mocked RTCPeerConnection.
 */
export interface PeerManagerOptions {
  /** Returns the local media stream to attach to new peers (may be null). */
  getLocalStream: () => MediaStream | null;
  /** Returns the local user id (used to ignore signals addressed elsewhere). */
  getMyId: () => string;
  /** Publishes an rtc signal for the given peer. */
  publishRtc: (payload: CallRtcPayload) => void;
  /** Called when a remote stream arrives for a peer. */
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  /** Called when a peer connection failed/closed and was removed. */
  onPeerRemoved: (peerId: string) => void;
  /** Factory so tests can inject a mock RTCPeerConnection. */
  peerFactory?: () => RTCPeerConnection;
}

export class PeerManager {
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly options: PeerManagerOptions;
  private readonly factory: () => RTCPeerConnection;

  constructor(options: PeerManagerOptions) {
    this.options = options;
    this.factory =
      options.peerFactory ??
      (() =>
        new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        }));
  }

  peerIds(): string[] {
    return [...this.peers.keys()];
  }

  getPeer(peerId: string): RTCPeerConnection | null {
    return this.peers.get(peerId) ?? null;
  }

  ensurePeer(peerId: string): RTCPeerConnection | null {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const stream = this.options.getLocalStream();
    if (!stream) return null;

    const pc = this.factory();
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.publishRtc({
          type: "ice",
          to: peerId,
          data: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      this.options.onRemoteStream(peerId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed" ||
        pc.connectionState === "disconnected"
      ) {
        this.removePeer(peerId);
        this.options.onPeerRemoved(peerId);
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  /** Initiates a connection to a peer with an offer. */
  async connectToPeer(peerId: string) {
    const pc = this.ensurePeer(peerId);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.options.publishRtc({ type: "offer", to: peerId, data: offer });
    } catch (error) {
      console.error("Offer failed:", error);
    }
  }

  /** Handles an incoming rtc signal (offer/answer/ice) from a sender. */
  async handleSignal(senderId: string, payload: CallRtcPayload) {
    if (payload.to && payload.to !== this.options.getMyId()) return;
    const pc = this.ensurePeer(senderId);
    if (!pc) return;

    try {
      if (payload.type === "offer") {
        const offer = payload.data as RTCSessionDescriptionInit;
        // Glare handling: roll back our own local description so the incoming
        // offer can be applied cleanly.
        if (pc.signalingState !== "stable") {
          try {
            await pc.setLocalDescription({ type: "rollback" });
          } catch {
            // Rollback unsupported — proceed anyway.
          }
        }
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.options.publishRtc({ type: "answer", to: senderId, data: answer });
      } else if (payload.type === "answer") {
        await pc.setRemoteDescription(payload.data as RTCSessionDescriptionInit);
      } else if (payload.type === "ice") {
        await pc.addIceCandidate(payload.data as RTCIceCandidateInit);
      }
    } catch (error) {
      console.error("RTC signal failed:", error);
    }
  }

  /** Closes and forgets a peer connection (does not fire onPeerRemoved). */
  removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
  }

  /** Closes every peer connection (used on call leave/unmount). */
  closeAll() {
    for (const peerId of this.peerIds()) {
      this.removePeer(peerId);
    }
  }

  /** Replaces the video track sent to every peer (screen share). */
  async replaceVideoTrack(track: MediaStreamTrack | null) {
    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (!sender) continue;
      try {
        await sender.replaceTrack(track);
      } catch {
        // Peer may be mid-negotiation — the next offer will settle it.
      }
    }
  }

  /** Enables/disables every received track (breakout-room end). */
  setReceiversEnabled(enabled: boolean) {
    for (const peerId of this.peerIds()) {
      this.setPeerReceiversEnabled(peerId, enabled);
    }
  }

  /** Enables/disables one peer's received tracks (breakout-room mutes). */
  setPeerReceiversEnabled(peerId: string, enabled: boolean) {
    const pc = this.peers.get(peerId);
    if (!pc) return;
    for (const receiver of pc.getReceivers()) {
      if (receiver.track) receiver.track.enabled = enabled;
    }
  }
}
