import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppwriteUser } from "@/lib/media/server";
import { createCallSignal } from "@/lib/call/server";
import { validateSignalRequest } from "@/lib/call/logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validated = validateSignalRequest(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    await createCallSignal({
      roomId: validated.roomId,
      senderId: user.$id,
      kind: validated.kind,
      payload: validated.payload,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Call signal publish error:", error);
    const message = error instanceof Error ? error.message : "Unable to publish signal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
