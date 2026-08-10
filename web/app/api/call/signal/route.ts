import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppwriteUser } from "@/lib/media/server";
import { createCallSignal } from "@/lib/call/server";
import type { CallSignalKind } from "@/lib/call/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KINDS: CallSignalKind[] = [
  "presence",
  "rtc",
  "chat",
  "whiteboard",
  "timer",
  "reaction",
  "breakout",
];

const MAX_PAYLOAD_LENGTH = 50_000;

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getAuthenticatedAppwriteUser>> = null;
  try {
    user = await getAuthenticatedAppwriteUser(request);
  } catch {
    // Appwrite not configured (e.g. local preview) — treat as signed out.
  }
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to join a call." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roomId = cleanString(body.roomId, 200);
  const kind = typeof body.kind === "string" ? (body.kind as CallSignalKind) : null;
  const payload = typeof body.payload === "string" ? body.payload.slice(0, MAX_PAYLOAD_LENGTH) : "";

  if (!roomId) {
    return NextResponse.json({ error: "roomId is required." }, { status: 400 });
  }
  if (!kind || !ALLOWED_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid signal kind." }, { status: 400 });
  }
  if (!payload) {
    return NextResponse.json({ error: "payload is required." }, { status: 400 });
  }

  try {
    await createCallSignal({ roomId, senderId: user.$id, kind, payload });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Call signal publish error:", error);
    const message = error instanceof Error ? error.message : "Unable to publish signal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
