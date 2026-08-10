import { describe, expect, it } from "vitest";
import {
  ALLOWED_SIGNAL_KINDS,
  MAX_BREAKOUT_ROOMS,
  MAX_SIGNAL_PAYLOAD_LENGTH,
  computeBreakoutAssignment,
  formatRemaining,
  shouldMutePeer,
  summarizePeerStats,
  validateSignalRequest,
} from "./logic";

describe("computeBreakoutAssignment", () => {
  it("is deterministic for the same id set (all clients agree)", () => {
    const ids = ["u-b", "u-a", "u-c", "u-d", "u-e"];
    const first = computeBreakoutAssignment(ids, 2);
    const second = computeBreakoutAssignment([...ids].reverse(), 2);
    expect(first).toEqual(second);
  });

  it("round-robins ids into the requested number of rooms", () => {
    const assignment = computeBreakoutAssignment(
      ["u1", "u2", "u3", "u4", "u5", "u6"],
      3,
    );
    // Sorted ids: u1,u2,u3,u4,u5,u6 -> rooms 0,1,2,0,1,2
    expect(assignment).toEqual({
      u1: 0,
      u2: 1,
      u3: 2,
      u4: 0,
      u5: 1,
      u6: 2,
    });
  });

  it("clamps the room count to the supported range", () => {
    expect(computeBreakoutAssignment(["a", "b", "c"], 99)).toEqual(
      computeBreakoutAssignment(["a", "b", "c"], MAX_BREAKOUT_ROOMS),
    );
    // A room count of 1 collapses everyone into the same room (no mutes).
    expect(computeBreakoutAssignment(["a", "b"], 1)).toEqual({ a: 0, b: 0 });
    expect(computeBreakoutAssignment([], 4)).toEqual({});
  });
});

describe("shouldMutePeer", () => {
  const assignment = { a: 0, b: 0, c: 1 };

  it("mutes peers in a different breakout room", () => {
    expect(shouldMutePeer(assignment, "a", "c", 2)).toBe(true);
  });

  it("keeps audio for peers in the same room", () => {
    expect(shouldMutePeer(assignment, "a", "b", 2)).toBe(false);
  });

  it("never mutes without an active assignment or a single room", () => {
    expect(shouldMutePeer(null, "a", "c", 2)).toBe(false);
    expect(shouldMutePeer(assignment, "a", "c", 1)).toBe(false);
  });
});

describe("formatRemaining", () => {
  it("formats as mm:ss and clamps at zero", () => {
    expect(formatRemaining(0)).toBe("0:00");
    expect(formatRemaining(-5000)).toBe("0:00");
    expect(formatRemaining(61_000)).toBe("1:01");
    expect(formatRemaining(3_599_000)).toBe("59:59");
  });
});

describe("validateSignalRequest", () => {
  it("passes through a valid request", () => {
    const result = validateSignalRequest({
      roomId: " room-1 ",
      kind: "chat",
      payload: '{"text":"hello"}',
    });
    expect(result).toEqual({
      roomId: "room-1",
      kind: "chat",
      payload: '{"text":"hello"}',
    });
  });

  it("rejects a missing roomId", () => {
    expect(validateSignalRequest({ kind: "rtc", payload: "{}" })).toEqual({
      error: "roomId is required.",
    });
  });

  it("rejects unknown signal kinds", () => {
    expect(
      validateSignalRequest({ roomId: "r", kind: "telepathy", payload: "{}" }),
    ).toEqual({ error: "Invalid signal kind." });
  });

  it("rejects an empty payload", () => {
    expect(validateSignalRequest({ roomId: "r", kind: "chat", payload: "" })).toEqual({
      error: "payload is required.",
    });
  });

  it("truncates oversized payloads instead of rejecting them", () => {
    const result = validateSignalRequest({
      roomId: "r",
      kind: "rtc",
      payload: "x".repeat(MAX_SIGNAL_PAYLOAD_LENGTH + 100),
    });
    expect(result).not.toHaveProperty("error");
    if (!("error" in result)) {
      expect(result.payload.length).toBe(MAX_SIGNAL_PAYLOAD_LENGTH);
    }
  });

  it("treats non-string fields as invalid", () => {
    expect(
      validateSignalRequest({ roomId: 42, kind: "chat", payload: "x" }),
    ).toEqual({ error: "roomId is required." });
    expect(
      validateSignalRequest({ roomId: "r", kind: 7, payload: "x" }),
    ).toEqual({ error: "Invalid signal kind." });
  });

  it("exposes the allowed kinds so route and client stay in sync", () => {
    expect(ALLOWED_SIGNAL_KINDS).toContain("presence");
    expect(ALLOWED_SIGNAL_KINDS).toContain("breakout");
  });
});

describe("summarizePeerStats", () => {
  function fakeStats(
    reports: Array<Record<string, unknown>>,
  ): RTCStatsReport {
    return {
      forEach: (callback: (report: RTCStats) => void) => {
        for (const report of reports) {
          callback(report as never);
        }
      },
    } as unknown as RTCStatsReport;
  }

  it("reports none before any video arrives", () => {
    expect(summarizePeerStats(fakeStats([])).quality).toBe("none");
  });

  it("rates a healthy video stream as good", () => {
    const summary = summarizePeerStats(
      fakeStats([
        {
          type: "inbound-rtp",
          kind: "video",
          jitter: 0.012,
          packetsReceived: 900,
          packetsLost: 5,
        },
        {
          type: "candidate-pair",
          state: "succeeded",
          currentRoundTripTime: 0.04,
          availableIncomingBitrate: 1_800_000,
        },
      ]),
    );
    expect(summary.quality).toBe("good");
    expect(summary.lossPct).toBeCloseTo(0.6);
    expect(summary.jitterMs).toBe(12);
    expect(summary.rttMs).toBe(40);
    expect(summary.bitrateKbps).toBe(1800);
  });

  it("downgrades to poor on high packet loss", () => {
    const summary = summarizePeerStats(
      fakeStats([
        {
          type: "inbound-rtp",
          kind: "video",
          jitter: 0.02,
          packetsReceived: 100,
          packetsLost: 12,
        },
      ]),
    );
    expect(summary.quality).toBe("poor");
  });

  it("downgrades to fair on jitter or rtt in the mid range", () => {
    const fairByJitter = summarizePeerStats(
      fakeStats([
        { type: "inbound-rtp", kind: "video", jitter: 0.08, packetsReceived: 50, packetsLost: 1 },
      ]),
    );
    expect(fairByJitter.quality).toBe("fair");

    const fairByRtt = summarizePeerStats(
      fakeStats([
        { type: "inbound-rtp", kind: "video", jitter: 0.01, packetsReceived: 50, packetsLost: 0 },
        { type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.35 },
      ]),
    );
    expect(fairByRtt.quality).toBe("fair");
  });
});
