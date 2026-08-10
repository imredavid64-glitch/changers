import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppwriteUser } from "@/lib/media/server";
import {
  ensureContactSchema,
  insertContactMessage,
  listContactMessages,
} from "@/lib/contact/server";
import { getContactRateLimitMax } from "@/lib/contact/config";
import { forwardContactMessage } from "@/lib/contact/email";
import { verifyAdminUser } from "@/lib/admin/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

// Best-effort in-memory rate limiting (per process). Good enough for a
// student-run platform; swap for a shared store if scaled to multiple hosts.
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > max;
}

export async function POST(request: NextRequest) {
  const maxPerHour = getContactRateLimitMax();
  const ip = getClientIp(request) || "unknown";
  if (isRateLimited(`contact:${ip}`, maxPerHour)) {
    return NextResponse.json(
      { error: "Too many messages from this device. Please try again later." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: real humans never see this field, so any value means a bot.
  // Respond as if the message was accepted so bots can't learn the trap.
  if (cleanString(body.company, 200)) {
    return NextResponse.json(
      { ok: true, message: "Message sent! We'll get back to you at the email you provided." },
      { status: 201 },
    );
  }

  const name = cleanString(body.name, 120);
  const email = cleanString(body.email, 200).toLowerCase();
  const organization = cleanString(body.organization, 200) || null;
  const subject = cleanString(body.subject, 200) || null;
  const message = cleanString(body.message, 5000);
  const pagePath = cleanString(body.pagePath, 500) || null;
  const consentGiven = body.consent === true || body.consentGiven === true;

  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Please write a message." }, { status: 400 });
  if (!consentGiven) {
    return NextResponse.json(
      { error: "Please accept the privacy notice so we can store and reply to your message." },
      { status: 400 },
    );
  }

  try {
    await ensureContactSchema();

    // Link the message to a signed-in account when the visitor has a session.
    let userId: string | null = null;
    try {
      const user = await getAuthenticatedAppwriteUser(request);
      if (user) userId = user.$id;
    } catch {
      // Appwrite may be unconfigured locally — still accept anonymous messages.
    }

    const record = await insertContactMessage({
      id: crypto.randomUUID(),
      name,
      email,
      organization,
      subject,
      message,
      userId,
      consentGiven: true,
      ipAddress: ip === "unknown" ? null : ip,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
      referrer: request.headers.get("referer")?.slice(0, 1000) || null,
      pagePath,
    });

    // Best-effort: also email the message to the team inboxes when SMTP is
    // configured. Email failures never fail the submission.
    void forwardContactMessage(record).then((result) => {
      if (!result.sent) {
        console.warn("Contact forward skipped:", result.reason);
      }
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Message sent! We'll get back to you at the email you provided.",
        reference: record.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Contact submission error:", error);
    const message = error instanceof Error ? error.message : "Unable to send your message.";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error?.message }, { status: admin.error?.status || 403 });
  }

  try {
    await ensureContactSchema();
    const messages = await listContactMessages(200);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Contact list error:", error);
    const message = error instanceof Error ? error.message : "Unable to load contact messages.";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
