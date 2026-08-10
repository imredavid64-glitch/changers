import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/admin/server";
import { ensureContactSchema, updateContactMessageStatus } from "@/lib/contact/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await verifyAdminUser(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error?.message }, { status: admin.error?.status || 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Message id is required." }, { status: 400 });
  }

  let body: { read?: boolean; replied?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    await ensureContactSchema();
    const record = await updateContactMessageStatus(id, {
      read: body.read === true ? true : body.read === false ? false : undefined,
      replied: body.replied === true ? true : body.replied === false ? false : undefined,
    });

    if (!record) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: record });
  } catch (error) {
    console.error("Contact status update error:", error);
    const message = error instanceof Error ? error.message : "Unable to update the message.";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
