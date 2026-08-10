import type { CallSignalKind } from "./types";

/** Signal kinds the signaling API accepts. */
export const ALLOWED_SIGNAL_KINDS: CallSignalKind[] = [
  "presence",
  "rtc",
  "chat",
  "whiteboard",
  "timer",
  "reaction",
  "breakout",
];

/** Hard cap on a single signal payload (SDP blobs and chat stay well under this). */
export const MAX_SIGNAL_PAYLOAD_LENGTH = 50_000;

/** Cap on room id length to keep the signaling documents small. */
export const MAX_ROOM_ID_LENGTH = 200;

/** Breakout rooms are clamped to this range. */
export const MIN_BREAKOUT_ROOMS = 2;
export const MAX_BREAKOUT_ROOMS = 8;

/**
 * Round-robin breakout assignment. Sorting the id list first makes the result
 * deterministic: every client computes the same assignment for the same set of
 * ids, so no single client has to be the authority.
 */
export function computeBreakoutAssignment(
  ids: string[],
  rooms: number,
): Record<string, number> {
  const assignment: Record<string, number> = {};
  const count = Math.max(1, Math.min(Math.floor(rooms), MAX_BREAKOUT_ROOMS));
  [...ids]
    .sort()
    .forEach((id, index) => {
      assignment[id] = index % count;
    });
  return assignment;
}

/**
 * Whether a peer's audio should be muted because they're in a different
 * breakout room. Outside an active breakout (or with a single room) nobody is
 * muted.
 */
export function shouldMutePeer(
  assignment: Record<string, number> | null,
  myId: string,
  peerId: string,
  rooms: number,
): boolean {
  if (!assignment || rooms <= 1) return false;
  return assignment[myId] !== assignment[peerId];
}

/** Formats a millisecond countdown as mm:ss, clamped at zero. */
export function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ---- Connection quality ---------------------------------------------------

export type CallQuality = "good" | "fair" | "poor" | "none";

export interface PeerQuality {
  quality: CallQuality;
  jitterMs: number;
  lossPct: number;
  rttMs: number;
  bitrateKbps: number;
}

/**
 * Summarizes an RTCStatsReport into a single per-peer quality snapshot.
 * Good = loss ≤2%, jitter ≤50ms, RTT ≤300ms; poor = loss >5% or jitter >150ms.
 */
export function summarizePeerStats(stats: RTCStatsReport): PeerQuality {
  let jitterMs = 0;
  let lossPct = 0;
  let rttMs = 0;
  let bitrateKbps = 0;
  let hasVideo = false;

  stats.forEach((report) => {
    if (report.type === "inbound-rtp" && report.kind === "video") {
      hasVideo = true;
      jitterMs = Math.max(jitterMs, (report.jitter ?? 0) * 1000);
      const received = report.packetsReceived ?? 0;
      const lost = report.packetsLost ?? 0;
      const total = received + lost;
      if (total > 0) {
        lossPct = Math.max(lossPct, (lost / total) * 100);
      }
    }
    if (report.type === "candidate-pair" && report.state === "succeeded") {
      rttMs = Math.max(rttMs, (report.currentRoundTripTime ?? 0) * 1000);
      bitrateKbps = Math.max(
        bitrateKbps,
        (report.availableIncomingBitrate ?? 0) / 1000,
      );
    }
  });

  const quality: CallQuality = !hasVideo
    ? "none"
    : lossPct > 5 || jitterMs > 150
      ? "poor"
      : lossPct > 2 || jitterMs > 50 || rttMs > 300
        ? "fair"
        : "good";

  return {
    quality,
    jitterMs: Math.round(jitterMs),
    lossPct: Math.round(lossPct * 10) / 10,
    rttMs: Math.round(rttMs),
    bitrateKbps: Math.round(bitrateKbps),
  };
}

export interface ValidatedSignal {
  roomId: string;
  kind: CallSignalKind;
  payload: string;
}

/**
 * Validates and normalizes a signal publish request. Returns the error message
 * on failure (with no fields), or the normalized fields on success.
 */
export function validateSignalRequest(body: unknown): ValidatedSignal | { error: string } {
  const record = (body ?? {}) as Record<string, unknown>;

  const roomId =
    typeof record.roomId === "string"
      ? record.roomId.trim().slice(0, MAX_ROOM_ID_LENGTH)
      : "";
  const kind =
    typeof record.kind === "string" ? (record.kind as CallSignalKind) : null;
  const payload =
    typeof record.payload === "string"
      ? record.payload.slice(0, MAX_SIGNAL_PAYLOAD_LENGTH)
      : "";

  if (!roomId) {
    return { error: "roomId is required." };
  }
  if (!kind || !ALLOWED_SIGNAL_KINDS.includes(kind)) {
    return { error: "Invalid signal kind." };
  }
  if (!payload) {
    return { error: "payload is required." };
  }

  return { roomId, kind, payload };
}
