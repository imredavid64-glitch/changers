import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppwriteUser } from "@/lib/media/server";
import { deleteUserData } from "@/lib/userdata/server";
import { verifyAdminUser } from "@/lib/admin/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedAppwriteUser(request);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to delete your data." }, { status: 401 });
  }

  let body: { confirm?: boolean; targetUserId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Confirmation is required. Re-send the request with confirm: true." },
      { status: 400 },
    );
  }

  // Callers may only erase their own data — unless they are an admin, who can
  // erase any user's data (used by the Admin Dashboard erase-user tool).
  const targetUserId =
    typeof body.targetUserId === "string" && body.targetUserId.trim() ? body.targetUserId.trim() : user.$id;

  if (targetUserId !== user.$id) {
    const admin = await verifyAdminUser(request);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error?.message }, { status: admin.error?.status || 403 });
    }
  }

  try {
    const result = await deleteUserData(targetUserId);
    return NextResponse.json({
      ok: true,
      message: targetUserId === user.$id ? "Your data has been deleted." : "User data has been erased.",
      targetUserId,
      deleted: result.deleted.length,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Delete user data error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete your data." },
      { status: 500 },
    );
  }
}
