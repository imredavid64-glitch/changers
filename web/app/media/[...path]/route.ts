import fs from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getMediaAssetByStorageKey, getMediaRoot } from "@/lib/media/server";
import { getMediaAssetFilePath, getMediaContentType } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizePathSegments(segments: string[]) {
  return segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: rawPathSegments } = await params;
    const pathSegments = sanitizePathSegments(rawPathSegments || []);

    if (pathSegments.length < 2) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    const fileName = pathSegments[pathSegments.length - 1];
    const storageKey = path.posix.join(...pathSegments.slice(0, -1));
    const asset = await getMediaAssetByStorageKey(storageKey);

    if (!asset || asset.visibility !== "public" || asset.deletedAt) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    const filePath = getMediaAssetFilePath(getMediaRoot(), storageKey, fileName);
    const fileStat = await stat(filePath);
    const contentType = getMediaContentType(fileName, asset.mimeType);
    const stream = fs.createReadStream(filePath);
    const body = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Media read failed", error);
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
}
