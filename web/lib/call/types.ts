/**
 * Realtime signaling model for video calls.
 *
 * Calls are peer-to-peer WebRTC; the `callSignals` Appwrite collection is the
 * message bus. Every signal is a document in that collection:
 *   room_id      — which call this signal belongs to
 *   sender_id    — Appwrite user id that published it
 *   kind         — what kind of event it is
 *   payload      — JSON string with kind-specific fields
 *   created_at_ms — wall-clock timestamp for ordering
 */
export type CallSignalKind =
  | "presence"
  | "rtc"
  | "chat"
  | "whiteboard"
  | "timer"
  | "reaction"
  | "breakout";

export interface CallSignalDoc {
  $id: string;
  room_id: string;
  sender_id: string;
  kind: CallSignalKind;
  payload: string;
  created_at_ms: number;
}

export interface CallPresencePayload {
  action: "join" | "heartbeat" | "leave";
  name?: string;
}

export interface CallRtcPayload {
  type: "offer" | "answer" | "ice";
  /** Peer id this message is addressed to (empty = everyone). */
  to?: string;
  data: unknown;
}

export interface CallChatPayload {
  text: string;
  name?: string;
  /** Breakout room index the sender is in (null = plenary). */
  breakout?: number | null;
}

export interface CallWhiteboardPayload {
  type: "stroke-start" | "stroke-point" | "stroke-end" | "clear" | "undo";
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}

export interface CallTimerPayload {
  action: "start" | "pause" | "reset";
  /** Duration in seconds (start). */
  seconds?: number;
  /** Epoch ms the countdown should end (start). */
  endsAt?: number;
}

export interface CallReactionPayload {
  emoji: string;
  name?: string;
}

export interface CallBreakoutPayload {
  action: "start" | "end";
  rooms?: number;
  /** userId -> room index, computed identically on every client. */
  assignment?: Record<string, number>;
}

export interface CallParticipant {
  id: string;
  name: string;
}
