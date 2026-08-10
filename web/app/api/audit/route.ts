import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/admin/server";
import { ensureAuditSchema, listAdminActions } from "@/lib/audit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error?.message }, { status: admin.error?.status || 403 });
  }

  try {
    await ensureAuditSchema();
    const actions = await listAdminActions(100);
    return NextResponse.json({ actions });
  } catch (error) {
    console.error("Audit list error:", error);
    const message = error instanceof Error ? error.message : "Unable to load audit log.";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
