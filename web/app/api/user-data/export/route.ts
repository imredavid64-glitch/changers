import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppwriteUser } from "@/lib/media/server";
import { exportUserData } from "@/lib/userdata/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedAppwriteUser(request);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to export your data." }, { status: 401 });
  }

  try {
    const bundle = await exportUserData(user.$id);
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export your data." },
      { status: 500 },
    );
  }
}
