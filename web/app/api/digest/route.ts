import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppwriteUser } from "@/lib/media/server";
import { buildAndSendDigest, fetchDigestData } from "@/lib/digest/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSignedInUser(request: NextRequest) {
  try {
    return await getAuthenticatedAppwriteUser(request);
  } catch {
    return null;
  }
}

/** Returns a preview of the caller's digest (no email is sent). */
export async function GET(request: NextRequest) {
  const user = await getSignedInUser(request);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  try {
    const data = await fetchDigestData(user.$id);
    return NextResponse.json({
      ok: true,
      digest: {
        messages: data.messages.length,
        posts: data.trendingPosts.length,
        senders: [...new Set(data.messages.map((message) => message.senderName))],
      },
    });
  } catch (error) {
    console.error("Digest preview failed:", error);
    const message = error instanceof Error ? error.message : "Unable to build the digest.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Composes and sends the caller's digest to their account email. */
export async function POST(request: NextRequest) {
  const user = await getSignedInUser(request);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const email = (user.email || "").trim();
  if (!email) {
    return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
  }

  try {
    const result = await buildAndSendDigest(user.$id, {
      name: user.name || "Changemaker",
      email,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Digest send failed:", error);
    const message = error instanceof Error ? error.message : "Unable to send the digest.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
