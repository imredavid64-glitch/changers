"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CameraOff,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PenTool,
  Timer,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToCallRoom, publishCallSignal } from "@/lib/call/client";
import type {
  CallBreakoutPayload,
  CallChatPayload,
  CallParticipant,
  CallPresencePayload,
  CallReactionPayload,
  CallRtcPayload,
  CallSignalDoc,
  CallTimerPayload,
  CallWhiteboardPayload,
} from "@/lib/call/types";
import {
  type CallQuality,
  type PeerQuality,
  computeBreakoutAssignment,
  formatRemaining,
  shouldMutePeer,
  summarizePeerStats,
} from "@/lib/call/logic";
import { PeerManager } from "@/lib/call/peer-manager";

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function getTurnServers(): RTCIceServer[] {
  const url = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();
  if (!url || !username || !credential) return [];
  return [{ urls: url, username, credential }];
}

const REACTION_EMOJIS = ["👏", "🎉", "❤️", "🙌", "🤔", "🚀"];

interface ReactionBurst {
  id: number;
  emoji: string;
  name: string;
}

interface TimerState {
  running: boolean;
  endsAt: number | null;
  durationSec: number | null;
  show: boolean;
}

const TIMER_PRESETS = [60, 300, 600, 900, 1800];

// ---- Connection quality (presentation) ------------------------------------

function qualityLabel(quality: CallQuality) {
  switch (quality) {
    case "good":
      return "Great connection";
    case "fair":
      return "Fair connection";
    case "poor":
      return "Poor connection";
    default:
      return "Connecting…";
  }
}

function qualityColor(quality: CallQuality) {
  switch (quality) {
    case "good":
      return "var(--moss)";
    case "fair":
      return "var(--sun)";
    case "poor":
      return "var(--coral)";
    default:
      return "rgba(16,24,32,0.4)";
  }
}

export default function VideoCallRoom({
  roomId,
  title = "Video call",
}: {
  roomId: string;
  title?: string;
}) {
  const { user } = useAuth();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [selfName, setSelfName] = useState("");

  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [mutedByBreakout, setMutedByBreakout] = useState<Record<string, boolean>>({});
  const [qualityByPeer, setQualityByPeer] = useState<Record<string, PeerQuality>>({});

  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ id: number; sender: string; text: string; breakout: number | null }>>([]);

  const [showBoard, setShowBoard] = useState(false);
  const [penColor, setPenColor] = useState("#2c8a7d");
  const [penSize, setPenSize] = useState(3);

  const [timer, setTimer] = useState<TimerState>({ running: false, endsAt: null, durationSec: null, show: false });
  const [timerCustom, setTimerCustom] = useState("");
  const [, setTick] = useState(0);
  const timerBeepedRef = useRef(false);

  const [breakout, setBreakout] = useState<{ active: boolean; rooms: number; assignment: Record<string, number> } | null>(null);
  const [breakoutRooms, setBreakoutRooms] = useState(2);

  const [reactions, setReactions] = useState<ReactionBurst[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const managerRef = useRef<PeerManager | null>(null);
  const myIdRef = useRef("");
  const lastSeenRef = useRef(new Map<string, number>());
  const strokesRef = useRef<Array<Array<{ x: number; y: number; color?: string; size?: number }>>>([]);
  const currentStrokeRef = useRef<Array<{ x: number; y: number; color?: string; size?: number }>>([]);
  const drawingRef = useRef(false);
  const breakoutRef = useRef(breakout);
  breakoutRef.current = breakout;
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const chatIdRef = useRef(0);

  // Re-render the countdown while a timer is active; beep once when it hits 0.
  useEffect(() => {
    if (!timer.endsAt) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => window.clearInterval(interval);
  }, [timer.endsAt]);

  useEffect(() => {
    if (!timer.endsAt) return;
    const remaining = timer.endsAt - Date.now();
    if (remaining <= 0 && !timerBeepedRef.current) {
      timerBeepedRef.current = true;
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.4, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.2);
        oscillator.start();
        oscillator.stop(context.currentTime + 1.2);
      } catch {
        // Audio unavailable — the visual cue is enough.
      }
    }
  }, [timer.endsAt, timerBeepedRef]);

  const publish = useCallback(
    (kind: CallSignalDoc["kind"], payload: string) => {
      void publishCallSignal({ roomId, kind, payload }).catch((error) => {
        console.error("Signal publish failed:", error);
      });
    },
    [roomId],
  );

  const sendPresence = useCallback(
    (action: CallPresencePayload["action"]) => {
      const payload: CallPresencePayload = { action, name: selfName };
      publish("presence", JSON.stringify(payload));
    },
    [publish, selfName],
  );

  // ---- Peer management (delegated to PeerManager for testability) ----------

  if (!managerRef.current) {
    managerRef.current = new PeerManager({
      getLocalStream: () => localStreamRef.current,
      getMyId: () => myIdRef.current,
      publishRtc: (payload) => publish("rtc", JSON.stringify(payload)),
      onRemoteStream: (peerId, stream) => {
        setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
        setParticipants((prev) =>
          prev.some((p) => p.id === peerId)
            ? prev
            : [...prev, { id: peerId, name: "Participant" }],
        );
      },
      onPeerRemoved: (peerId) => {
        clearPeerState(peerId);
      },
      peerFactory: () =>
        new RTCPeerConnection({ iceServers: [...STUN_SERVERS, ...getTurnServers()] }),
    });
  }

  function clearPeerState(peerId: string) {
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    setParticipants((prev) => prev.filter((p) => p.id !== peerId));
    setQualityByPeer((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }

  function removePeer(peerId: string) {
    managerRef.current?.removePeer(peerId);
    clearPeerState(peerId);
  }

  // ---- Local media ---------------------------------------------------------

  useEffect(() => {
    if (!user) return;
    myIdRef.current = user.$id;
    setSelfName(user.name || "Anonymous");

    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch {
        // Camera/mic unavailable (e.g. permissions or headless preview) — the
        // call UI still works for chat/whiteboard; peers just won't get media.
      }
    }
    void start();

    return () => {
      cancelled = true;
      localStreamRef.current = null;
    };
  }, [user]);

  // ---- Signaling subscription + presence ----------------------------------

  useEffect(() => {
    if (!user) return;
    myIdRef.current = user.$id;
    const name = user.name || "Anonymous";
    setSelfName(name);

    const unsubscribe = subscribeToCallRoom(roomId, (signal) => {
      if (signal.sender_id === myIdRef.current) return;
      lastSeenRef.current.set(signal.sender_id, Date.now());
      handleSignal(signal);
    });

    // Announce ourselves, then heartbeat every 15s.
    sendPresence("join");
    const heartbeat = window.setInterval(() => sendPresence("heartbeat"), 15_000);
    const cleanup = window.setInterval(() => {
      const now = Date.now();
      for (const [peerId, lastSeen] of lastSeenRef.current) {
        if (now - lastSeen > 60_000) {
          removePeer(peerId);
          lastSeenRef.current.delete(peerId);
        }
      }
    }, 20_000);      return () => {
        window.clearInterval(heartbeat);
        window.clearInterval(cleanup);
        sendPresence("leave");
        unsubscribe();
        // Close every peer connection.
        managerRef.current?.closeAll();
        setParticipants([]);
        setRemoteStreams({});
        setQualityByPeer({});
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, user]);

  // ---- Connection quality ------------------------------------------------

  // Poll WebRTC stats per peer so each tile (and the header) can show live
  // quality: packet loss, jitter, round-trip time, and estimated bandwidth.
  useEffect(() => {
    if (participants.length === 0) return;
    const manager = managerRef.current;
    if (!manager) return;
    const interval = window.setInterval(() => {
      for (const peerId of manager.peerIds()) {
        const pc = manager.getPeer(peerId);
        if (!pc) continue;
        pc.getStats()
          .then((stats) => {
            setQualityByPeer((prev) => ({ ...prev, [peerId]: summarizePeerStats(stats) }));
          })
          .catch(() => {
            // Stats unavailable — keep the last snapshot.
          });
      }
    }, 4000);
    return () => window.clearInterval(interval);
  }, [participants.length]);

  // ---- Peer management (implemented in lib/call/peer-manager.ts) -----------

  async function connectToPeer(peerId: string) {
    await managerRef.current?.connectToPeer(peerId);
  }

  async function handleRtcSignal(senderId: string, payload: CallRtcPayload) {
    await managerRef.current?.handleSignal(senderId, payload);
  }

  // ---- Signal dispatch -----------------------------------------------------

  function handleSignal(signal: CallSignalDoc) {
    let payload: unknown;
    try {
      payload = JSON.parse(signal.payload);
    } catch {
      return;
    }

    switch (signal.kind) {
      case "presence": {
        const presence = payload as CallPresencePayload;
        if (presence.action === "join") {
          setParticipants((prev) => {
            if (prev.some((p) => p.id === signal.sender_id)) return prev;
            const next = [...prev, { id: signal.sender_id, name: presence.name || "Participant" }];
            return next;
          });
          void connectToPeer(signal.sender_id);
        } else if (presence.action === "leave") {
          removePeer(signal.sender_id);
        } else if (presence.action === "heartbeat") {
          setParticipants((prev) =>
            prev.some((p) => p.id === signal.sender_id)
              ? prev
              : [...prev, { id: signal.sender_id, name: presence.name || "Participant" }],
          );
        }
        break;
      }
      case "rtc": {
        void handleRtcSignal(signal.sender_id, payload as CallRtcPayload);
        break;
      }
      case "chat": {
        const chat = payload as CallChatPayload;
        setChatMessages((prev) => [
          ...prev,
          {
            id: chatIdRef.current++,
            sender: chat.name || "Someone",
            text: chat.text,
            breakout: chat.breakout ?? null,
          },
        ]);
        break;
      }
      case "whiteboard": {
        applyRemoteStroke(payload as CallWhiteboardPayload);
        break;
      }
      case "timer": {
        applyRemoteTimer(payload as CallTimerPayload);
        break;
      }
      case "reaction": {
        const reaction = payload as CallReactionPayload;
        const id = Date.now() + Math.random();
        setReactions((prev) => [...prev, { id, emoji: reaction.emoji, name: reaction.name || "Someone" }]);
        window.setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2600);
        break;
      }
      case "breakout": {
        applyRemoteBreakout(payload as CallBreakoutPayload);
        break;
      }
    }
  }

  // ---- Mic / cam / screen --------------------------------------------------

  function toggleMic() {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    for (const track of audioTracks) {
      track.enabled = !track.enabled;
    }
    setMicOn((prev) => !prev);
  }

  function toggleCam() {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    for (const track of videoTracks) {
      track.enabled = !track.enabled;
    }
    setCamOn((prev) => !prev);
  }

  async function toggleScreenShare() {
    if (screenStream) {
      stopScreenShare();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) return;
      screenTrack.onended = () => stopScreenShare();
      setScreenStream(stream);

      await managerRef.current?.replaceVideoTrack(screenTrack);
    } catch {
      // User cancelled the share picker.
    }
  }

  function stopScreenShare() {
    setScreenStream((prev) => {
      if (prev) prev.getTracks().forEach((track) => track.stop());
      return null;
    });
    const cameraTrack = localStream?.getVideoTracks()[0] ?? null;
    void managerRef.current?.replaceVideoTrack(cameraTrack);
  }

  // ---- Chat ----------------------------------------------------------------

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    const payload: CallChatPayload = {
      text,
      name: selfName,
      breakout: breakout?.assignment[myIdRef.current] ?? null,
    };
    setChatMessages((prev) => [
      ...prev,
      { id: chatIdRef.current++, sender: `${selfName} (you)`, text, breakout: payload.breakout ?? null },
    ]);
    setChatInput("");
    publish("chat", JSON.stringify(payload));
  }

  // ---- Whiteboard ----------------------------------------------------------

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function redrawAll() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      context.strokeStyle = stroke[0].color || penColor;
      context.lineWidth = stroke[0].size || penSize;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) {
        context.lineTo(point.x, point.y);
      }
      context.stroke();
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const point = getCanvasPoint(event);
    currentStrokeRef.current = [{ ...point, color: penColor, size: penSize }];
    const payload: CallWhiteboardPayload = {
      type: "stroke-start",
      x: point.x,
      y: point.y,
      color: penColor,
      size: penSize,
    };
    publish("whiteboard", JSON.stringify(payload));
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const point = getCanvasPoint(event);
    const stroke = currentStrokeRef.current;
    stroke.push(point);
    drawSegment(stroke[stroke.length - 2], point);
    const payload: CallWhiteboardPayload = { type: "stroke-point", x: point.x, y: point.y };
    publish("whiteboard", JSON.stringify(payload));
  }

  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    if (stroke.length >= 2) {
      strokesRef.current.push(stroke);
    }
    currentStrokeRef.current = [];
    publish("whiteboard", JSON.stringify({ type: "stroke-end" }));
  }

  function drawSegment(from: { x: number; y: number; color?: string; size?: number } | undefined, to: { x: number; y: number }) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !from) return;
    context.strokeStyle = from.color || penColor;
    context.lineWidth = from.size || penSize;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  function applyRemoteStroke(payload: CallWhiteboardPayload) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    switch (payload.type) {
      case "stroke-start": {
        currentStrokeRef.current = [{ x: payload.x ?? 0, y: payload.y ?? 0, color: payload.color || penColor, size: payload.size || penSize }];
        break;
      }
      case "stroke-point": {
        const stroke = currentStrokeRef.current;
        const from = stroke[stroke.length - 1];
        const to = { x: payload.x ?? 0, y: payload.y ?? 0 };
        stroke.push(to);
        drawSegment(from, to);
        break;
      }
      case "stroke-end": {
        if (currentStrokeRef.current.length >= 2) {
          strokesRef.current.push(currentStrokeRef.current);
        }
        currentStrokeRef.current = [];
        break;
      }
      case "clear": {
        strokesRef.current = [];
        redrawAll();
        break;
      }
      case "undo": {
        strokesRef.current.pop();
        redrawAll();
        break;
      }
    }
  }

  function clearBoard() {
    strokesRef.current = [];
    redrawAll();
    publish("whiteboard", JSON.stringify({ type: "clear" }));
  }

  function undoBoard() {
    strokesRef.current.pop();
    redrawAll();
    publish("whiteboard", JSON.stringify({ type: "undo" }));
  }

  // ---- Timer ---------------------------------------------------------------

  function applyRemoteTimer(payload: CallTimerPayload) {
    if (payload.action === "start") {
      setTimer({ running: true, endsAt: payload.endsAt ?? Date.now() + (payload.seconds ?? 0) * 1000, durationSec: payload.seconds ?? null, show: true });
      timerBeepedRef.current = false;
    } else if (payload.action === "pause") {
      setTimer((prev) => ({ ...prev, running: false }));
    } else if (payload.action === "reset") {
      setTimer({ running: false, endsAt: null, durationSec: null, show: false });
      timerBeepedRef.current = false;
    }
  }

  function startTimer(seconds: number) {
    const endsAt = Date.now() + seconds * 1000;
    const payload: CallTimerPayload = { action: "start", seconds, endsAt };
    setTimer({ running: true, endsAt, durationSec: seconds, show: true });
    timerBeepedRef.current = false;
    publish("timer", JSON.stringify(payload));
  }

  function pauseTimer() {
    setTimer((prev) => ({ ...prev, running: false }));
    publish("timer", JSON.stringify({ action: "pause" }));
  }

  function resetTimer() {
    setTimer({ running: false, endsAt: null, durationSec: null, show: false });
    timerBeepedRef.current = false;
    publish("timer", JSON.stringify({ action: "reset" }));
  }

  function startCustomTimer() {
    const parsed = Number.parseInt(timerCustom, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 7200) {
      startTimer(parsed);
      setTimerCustom("");
    }
  }

  // ---- Breakout rooms ------------------------------------------------------

  function startBreakout() {
    const rooms = Math.max(2, Math.min(breakoutRooms, 8));
    const ids = [myIdRef.current, ...participantsRef.current.map((p) => p.id)];
    const assignment = computeBreakoutAssignment(ids, rooms);
    setBreakout({ active: true, rooms, assignment });
    applyBreakoutMutes(assignment, rooms);
    const payload: CallBreakoutPayload = { action: "start", rooms, assignment };
    publish("breakout", JSON.stringify(payload));
  }

  function endBreakout() {
    setBreakout(null);
    setMutedByBreakout({});
    managerRef.current?.setReceiversEnabled(true);
    publish("breakout", JSON.stringify({ action: "end" }));
  }

  function applyBreakoutMutes(assignment: Record<string, number>, rooms: number) {
    const myId = myIdRef.current;
    const muted: Record<string, boolean> = {};
    const manager = managerRef.current;
    for (const peerId of manager?.peerIds() ?? []) {
      const shouldMute = shouldMutePeer(assignment, myId, peerId, rooms);
      muted[peerId] = shouldMute;
      manager?.setPeerReceiversEnabled(peerId, !shouldMute);
    }
    setMutedByBreakout(muted);
  }

  function applyRemoteBreakout(payload: CallBreakoutPayload) {
    if (payload.action === "end") {
      setBreakout(null);
      setMutedByBreakout({});
      managerRef.current?.setReceiversEnabled(true);
      return;
    }
    const assignment = payload.assignment || computeBreakoutAssignment([myIdRef.current, ...participantsRef.current.map((p) => p.id)], payload.rooms || 2);
    setBreakout({ active: true, rooms: payload.rooms || 2, assignment });
    applyBreakoutMutes(assignment, payload.rooms || 2);
  }

  // ---- Reactions -----------------------------------------------------------

  function sendReaction(emoji: string) {
    const id = Date.now() + Math.random();
    setReactions((prev) => [...prev, { id, emoji, name: `${selfName} (you)` }]);
    window.setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2600);
    const payload: CallReactionPayload = { emoji, name: selfName };
    publish("reaction", JSON.stringify(payload));
  }

  // ---- Render --------------------------------------------------------------

  const myBreakoutRoom = breakout?.assignment[myIdRef.current] ?? null;

  const overallQuality: CallQuality = (() => {
    const qualities = Object.values(qualityByPeer);
    if (qualities.length === 0) return "none";
    if (qualities.every((q) => q.quality === "none")) return "none";
    if (qualities.some((q) => q.quality === "poor")) return "poor";
    if (qualities.some((q) => q.quality === "fair")) return "fair";
    return "good";
  })();

  if (!user) {
    return (
      <section style={{ textAlign: "center", padding: "48px 24px" }}>
        <h2>Video calls</h2>
        <p className="muted">Sign in to join the call — camera, chat, whiteboard, breakout rooms, and a shared timer.</p>
        <Link href="/sign-in" className="primary" style={{ display: "inline-block", marginTop: 8, textDecoration: "none" }}>
          Sign in
        </Link>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12, minHeight: "60vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            {participants.length + 1} in call
            {overallQuality !== "none" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: 8,
                  padding: "1px 8px",
                  borderRadius: 999,
                  background: "rgba(44,138,125,0.1)",
                }}
                title="Live connection quality across all participants"
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: qualityColor(overallQuality),
                    display: "inline-block",
                  }}
                />
                {qualityLabel(overallQuality)}
              </span>
            )}
            {breakout?.active ? ` · Breakout rooms (${breakout.rooms})` : ""}
            {myBreakoutRoom !== null && breakout?.active ? ` · You are in room ${myBreakoutRoom + 1}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Timer size={18} color="var(--moss)" />
          <span style={{ fontVariantNumeric: "tabular-nums", fontSize: "1.1rem", fontWeight: 600, minWidth: 64 }}>
            {timer.endsAt ? formatRemaining(timer.endsAt - Date.now()) : "--:--"}
          </span>
          {timer.endsAt && timer.endsAt - Date.now() <= 0 && (
            <span className="chip" style={{ background: "var(--coral)", color: "white" }}>Time&apos;s up!</span>
          )}
        </div>
      </div>

      {/* Video grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignContent: "start" }}>
        {/* Self */}
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "4/3", background: "#101820" }}>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          {!camOn && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", background: "rgba(16,24,32,0.7)" }}>
              <CameraOff size={40} />
            </div>
          )}
          <span style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: "0.8rem" }}>
            {selfName} (you){!micOn ? " · muted" : ""}
          </span>
          {screenStream && (
            <span style={{ position: "absolute", top: 8, right: 8, background: "rgba(44,138,125,0.9)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: "0.75rem" }}>
              Sharing screen
            </span>
          )}
        </div>

        {/* Remote participants */}
        {participants.map((participant) => {
          const stream = remoteStreams[participant.id];
          const breakoutMuted = mutedByBreakout[participant.id];
          const room = breakout?.assignment[participant.id] ?? null;
          const isSameRoom = breakout?.active ? room === myBreakoutRoom : true;
          return (
            <div
              key={participant.id}
              style={{
                position: "relative",
                borderRadius: 14,
                overflow: "hidden",
                aspectRatio: "4/3",
                background: "#101820",
                opacity: breakout?.active && !isSameRoom ? 0.45 : 1,
              }}
            >
              {stream ? (
                <video
                  autoPlay
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  ref={(video) => {
                    if (video && video.srcObject !== stream) video.srcObject = stream;
                  }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", background: "rgba(16,24,32,0.6)" }}>
                  <Users size={36} />
                </div>
              )}
              {(() => {
                const quality = qualityByPeer[participant.id];
                if (!quality || quality.quality === "none") return null;
                return (
                  <span
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      borderRadius: 8,
                      padding: "2px 8px",
                      fontSize: "0.75rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title={`Jitter ${quality.jitterMs}ms · Packet loss ${quality.lossPct}% · RTT ${quality.rttMs}ms · ~${quality.bitrateKbps} kbps`}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: qualityColor(quality.quality),
                        display: "inline-block",
                      }}
                    />
                    {qualityLabel(quality.quality)}
                  </span>
                );
              })()}
              <span style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: "0.8rem" }}>
                {participant.name}
                {breakoutMuted ? " · muted (breakout)" : ""}
              </span>
              {breakout?.active && room !== null && (
                <span style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: "0.75rem" }}>
                  Room {room + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Panels: chat + whiteboard */}
      {(showChat || showBoard) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(420px, 92vw)",
            background: "white",
            boxShadow: "0 0 40px rgba(0,0,0,0.18)",
            zIndex: 60,
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            padding: 16,
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{showBoard ? "Whiteboard" : "Call chat"}</h3>
            <button className="ghost" onClick={() => { setShowChat(false); setShowBoard(false); }} aria-label="Close panel">
              <X size={18} />
            </button>
          </div>

          {showBoard ? (
            <>
              <div
                ref={canvasWrapRef}
                style={{ position: "relative", border: "1px solid rgba(16,24,32,0.12)", borderRadius: 12, overflow: "hidden", background: "white", touchAction: "none" }}
              >
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={560}
                  style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerUp}
                />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="color"
                  value={penColor}
                  onChange={(event) => setPenColor(event.target.value)}
                  aria-label="Pen color"
                  style={{ width: 40, height: 36, border: "none", background: "none", cursor: "pointer" }}
                />
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={penSize}
                  onChange={(event) => setPenSize(Number(event.target.value))}
                  aria-label="Pen size"
                  style={{ flex: 1, minWidth: 80 }}
                />
                <button className="ghost" onClick={undoBoard} style={{ fontSize: "0.8rem" }}>Undo</button>
                <button className="ghost" onClick={clearBoard} style={{ fontSize: "0.8rem", color: "var(--coral)" }}>Clear</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8, overflowY: "auto", alignContent: "start" }}>
                {chatMessages.length === 0 && <p className="muted" style={{ fontSize: "0.9rem" }}>No messages yet. Say hello!</p>}
                {chatMessages.map((message) => (
                  <div key={message.id} style={{ background: "rgba(16,24,32,0.04)", borderRadius: 10, padding: "8px 12px" }}>
                    <p style={{ fontWeight: 600, fontSize: "0.8rem", margin: 0 }}>
                      {message.sender}
                      {message.breakout !== null ? <span className="muted" style={{ fontWeight: 400 }}> · room {message.breakout + 1}</span> : null}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{message.text}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") sendChat(); }}
                  placeholder="Message the call..."
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(16,24,32,0.15)", fontSize: "0.9rem" }}
                />
                <button className="primary" onClick={sendChat}>Send</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reactions overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 55, overflow: "hidden" }}>
        {reactions.map((reaction) => (
          <span
            key={reaction.id}
            style={{
              position: "absolute",
              left: "20%",
              top: "30%",
              fontSize: "3rem",
              animation: "callReactionFloat 2.5s ease-out forwards",
            }}
          >
            {reaction.emoji}
          </span>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", padding: "8px 0" }}>
        <button className={micOn ? "ghost" : "primary"} onClick={toggleMic} title={micOn ? "Mute microphone" : "Unmute microphone"} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button className={camOn ? "ghost" : "primary"} onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {camOn ? <Camera size={18} /> : <CameraOff size={18} />}
        </button>
        <button className={screenStream ? "primary" : "ghost"} onClick={() => void toggleScreenShare()} title={screenStream ? "Stop sharing screen" : "Share screen"} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {screenStream ? <MonitorX size={18} /> : <MonitorUp size={18} />}
        </button>
        <button className={showChat ? "primary" : "ghost"} onClick={() => { setShowBoard(false); setShowChat((prev) => !prev); }} title="Chat" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessageSquare size={18} />
        </button>
        <button className={showBoard ? "primary" : "ghost"} onClick={() => { setShowChat(false); setShowBoard((prev) => !prev); }} title="Whiteboard" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <PenTool size={18} />
        </button>
        <button className="ghost" title="Timer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setTimer((prev) => ({ ...prev, show: !prev.show }))}>
          <Timer size={18} />
        </button>
        {REACTION_EMOJIS.map((emoji) => (
          <button key={emoji} className="ghost" onClick={() => sendReaction(emoji)} title={`Send ${emoji}`} style={{ fontSize: "1.1rem", padding: "6px 8px" }}>
            {emoji}
          </button>
        ))}
        <button
          className={breakout?.active ? "primary" : "ghost"}
          onClick={() => (breakout?.active ? endBreakout() : startBreakout())}
          title={breakout?.active ? "End breakout rooms" : "Start breakout rooms"}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Users size={18} />
        </button>
        <button
          className="ghost"
          style={{ color: "var(--coral)", display: "inline-flex", alignItems: "center", gap: 6 }}
          onClick={() => { sendPresence("leave"); window.location.href = "/rooms"; }}
        >
          Leave
        </button>
      </div>

      {/* Timer panel */}
      {timer.show && (
        <div style={{ background: "white", border: "1px solid rgba(16,24,32,0.1)", borderRadius: 14, padding: 16, display: "grid", gap: 10, maxWidth: 420 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong>Timer</strong>
            <span style={{ fontSize: "1.6rem", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
              {timer.endsAt ? formatRemaining(timer.endsAt - Date.now()) : "--:--"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TIMER_PRESETS.map((seconds) => (
              <button key={seconds} className="ghost" onClick={() => startTimer(seconds)} style={{ fontSize: "0.85rem" }}>
                {seconds >= 60 ? `${seconds / 60}m` : `${seconds}s`}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              min={1}
              max={7200}
              value={timerCustom}
              onChange={(event) => setTimerCustom(event.target.value)}
              placeholder="Custom seconds"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(16,24,32,0.15)", fontSize: "0.85rem" }}
            />
            <button className="ghost" onClick={startCustomTimer} style={{ fontSize: "0.85rem" }}>Set</button>
            {timer.running ? (
              <button className="ghost" onClick={pauseTimer} style={{ fontSize: "0.85rem" }}>Pause</button>
            ) : (
              <button className="ghost" onClick={resetTimer} style={{ fontSize: "0.85rem" }}>Reset</button>
            )}
          </div>
        </div>
      )}

      {/* Breakout panel */}
      {!breakout?.active && (
        <div style={{ background: "white", border: "1px solid rgba(16,24,32,0.1)", borderRadius: 14, padding: 16, display: "flex", gap: 10, alignItems: "center", maxWidth: 420 }}>
          <Users size={18} />
          <span style={{ fontSize: "0.9rem" }}>Breakout rooms</span>
          <input
            type="number"
            min={2}
            max={8}
            value={breakoutRooms}
            onChange={(event) => setBreakoutRooms(Math.max(2, Math.min(8, Number(event.target.value) || 2)))}
            style={{ width: 56, padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(16,24,32,0.15)", fontSize: "0.85rem" }}
            aria-label="Number of breakout rooms"
          />
          <button className="primary" onClick={startBreakout} style={{ fontSize: "0.85rem" }}>Start</button>
        </div>
      )}

      <style>{`
        @keyframes callReactionFloat {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { opacity: 1; transform: translateY(-20px) scale(1.1); }
          100% { transform: translateY(-140px) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
