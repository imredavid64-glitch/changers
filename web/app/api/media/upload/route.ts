import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  ensureMediaSchema,
  assertMediaFreeSpace,
  getAuthenticatedAppwriteUser,
  getMediaRoot,
  insertMediaAsset,
} from "@/lib/media/server";
import { buildMediaUrl, getMediaMaxUploadBytes } from "@/lib/media/config";
import {
  isSupportedMediaMimeType,
  removeMediaAssetFiles,
  writeMediaAssetFiles,
} from "@/lib/media/storage";
import type { MediaPurpose, MediaVisibility } from "@/lib/media/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PURPOSE: MediaPurpose = "post";

function parsePurpose(value: FormDataEntryValue | null): MediaPurpose {
  const purpose = typeof value === "string" ? value : "";
  return purpose === "avatar" || purpose === "post" || purpose === "attachment" ? purpose : DEFAULT_PURPOSE;
}

function parseVisibility(value: FormDataEntryValue | null): MediaVisibility {
  const visibility = typeof value === "string" ? value : "";
  return visibility === "private" ? "private" : "public";
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedAppwriteUser(request);
    if (!user) {
      return NextResponse.json({ error: "You must be signed in to upload media." }, { status: 401 });
    }

    await ensureMediaSchema();
    await assertMediaFreeSpace();

    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: "Attach an image file." }, { status: 400 });
    }

    if (fileValue.size <= 0) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
    }

    const maxUploadBytes = getMediaMaxUploadBytes();
    if (fileValue.size > maxUploadBytes) {
      return NextResponse.json(
        { error: `Files must be smaller than ${Math.floor(maxUploadBytes / (1024 * 1024))} MB.` },
        { status: 413 },
      );
    }

    if (!isSupportedMediaMimeType(fileValue.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, AVIF images, and MP4/WebM/MOV videos are supported." },
        { status: 415 },
      );
    }

    const purpose = parsePurpose(formData.get("purpose"));
    const visibility = parseVisibility(formData.get("visibility"));
    const mediaId = crypto.randomUUID();
    const buffer = Buffer.from(await fileValue.arrayBuffer());

    const written = await writeMediaAssetFiles({
      mediaRoot: getMediaRoot(),
      mediaId,
      purpose,
      visibility,
      buffer,
      mimeType: fileValue.type,
      originalFilename: fileValue.name,
    });

    try {
      const asset = await insertMediaAsset({
        id: written.mediaId,
        ownerUserId: user.$id,
        purpose: written.purpose,
        visibility: written.visibility,
        storageKey: written.storageKey,
        originalFilename: written.originalFilename,
        mimeType: written.mimeType,
        sizeBytes: written.sizeBytes,
        widthPx: written.widthPx,
        heightPx: written.heightPx,
        sha256: written.sha256,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      });

      const baseUrl = new URL(request.url).origin;

      let originalExtension = "jpg";
      if (asset.mimeType === "image/png") originalExtension = "png";
      else if (asset.mimeType === "image/webp") originalExtension = "webp";
      else if (asset.mimeType === "image/avif") originalExtension = "avif";
      else if (asset.mimeType === "video/mp4") originalExtension = "mp4";
      else if (asset.mimeType === "video/webm") originalExtension = "webm";
      else if (asset.mimeType === "video/quicktime") originalExtension = "mov";

      const isVideo = asset.mimeType.startsWith("video/");
      const previewUrl = isVideo
        ? buildMediaUrl(asset.storageKey, `original.${originalExtension}`, baseUrl)
        : buildMediaUrl(asset.storageKey, "preview.webp", baseUrl);
      const thumbnailUrl = isVideo
        ? buildMediaUrl(asset.storageKey, `original.${originalExtension}`, baseUrl)
        : buildMediaUrl(asset.storageKey, "thumbnail.webp", baseUrl);
      const originalUrl = buildMediaUrl(asset.storageKey, `original.${originalExtension}`, baseUrl);

      return NextResponse.json(
        {
          mediaId: asset.id,
          storageKey: asset.storageKey,
          publicUrl: previewUrl,
          previewUrl,
          thumbnailUrl,
          originalUrl,
          purpose: asset.purpose,
          visibility: asset.visibility,
          originalFilename: asset.originalFilename,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          widthPx: asset.widthPx,
          heightPx: asset.heightPx,
          sha256: asset.sha256,
        },
        { status: 201 },
      );
    } catch (error) {
      await removeMediaAssetFiles(getMediaRoot(), written.storageKey);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload media.";
    const status = message.includes("free") ? 507 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
