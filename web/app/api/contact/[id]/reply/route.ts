import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/admin/server";
import { ensureContactSchema, getContactMessage, updateContactMessageStatus } from "@/lib/contact/server";
import { sendReplyEmail } from "@/lib/contact/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await verifyAdminUser(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error?.message }, { status: admin.error?.status || 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Message id is required." }, { status: 400 });
  }

  let body: { reply?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const reply = typeof body.reply === "string" ? body.reply.trim() : "";
  if (!reply) {
    return NextResponse.json({ error: "Reply text is required." }, { status: 400 });
  }
  if (reply.length > 5000) {
    return NextResponse.json({ error: "Reply is too long (max 5000 characters)." }, { status: 400 });
  }

  try {
    await ensureContactSchema();
    const record = await getContactMessage(id);
    if (!record) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    const result = await sendReplyEmail(record, reply);
    if (!result.sent) {
      return NextResponse.json(
        { error: `Reply could not be sent: ${result.reason || "unknown error"}` },
        { status: 503 },
      );
    }

    // Mark as replied (and read) once the email goes out.
    const updated = await updateContactMessageStatus(id, { replied: true, read: true });

    return NextResponse.json({ ok: true, subject: result.subject, message: updated });
  } catch (error) {
    console.error("Contact reply error:", error);
    const message = error instanceof Error ? error.message : "Unable to send the reply.";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
