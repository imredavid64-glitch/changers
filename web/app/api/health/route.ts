import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/admin/server";
import { runPlatformHealthChecks } from "@/lib/appwrite/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error?.message }, { status: admin.error?.status || 403 });
  }

  try {
    const report = await runPlatformHealthChecks();
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Health check error:", error);
    const message = error instanceof Error ? error.message : "Unable to run platform health checks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}