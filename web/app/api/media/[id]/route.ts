import { NextResponse } from "next/server";
import {
  ensureMediaSchema,
  getAuthenticatedAppwriteUser,
  getMediaAssetById,
  getMediaRoot,
  softDeleteMediaAsset,
} from "@/lib/media/server";
import { removeMediaAssetFiles } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedAppwriteUser(request);
    if (!user) {
      return NextResponse.json({ error: "You must be signed in to delete media." }, { status: 401 });
    }

    await ensureMediaSchema();

    const asset = await getMediaAssetById(id);
    if (!asset) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    if (asset.ownerUserId !== user.$id) {
      return NextResponse.json({ error: "You do not own this media asset." }, { status: 403 });
    }

    const deleted = await softDeleteMediaAsset(id);
    if (!deleted) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    try {
      await removeMediaAssetFiles(getMediaRoot(), deleted.storageKey);
    } catch (cleanupError) {
      console.error("Media cleanup failed", cleanupError);
    }

    return NextResponse.json({ deleted: true, mediaId: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete media.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

