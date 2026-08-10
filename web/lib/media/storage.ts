import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { buildStorageKey, normalizeMediaPathSegment } from "./config";
import {
  SUPPORTED_MEDIA_MIME_TYPES,
  type MediaPurpose,
  type MediaVariant,
  type MediaVisibility,
  type SupportedMediaMimeType,
} from "./types";

const MIME_TO_EXTENSION: Partial<Record<SupportedMediaMimeType, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const SHARP_FORMAT_TO_MIME_TYPE: Record<string, SupportedMediaMimeType | null> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export interface WriteMediaAssetFilesInput {
  mediaRoot: string;
  mediaId: string;
  purpose: MediaPurpose;
  visibility: MediaVisibility;
  buffer: Buffer;
  mimeType: SupportedMediaMimeType;
  originalFilename: string;
}

export interface WriteMediaAssetFilesResult {
  mediaId: string;
  storageKey: string;
  purpose: MediaPurpose;
  visibility: MediaVisibility;
  originalFilename: string;
  mimeType: SupportedMediaMimeType;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  sha256: string;
  assetDir: string;
  originalPath: string;
  previewPath: string;
  thumbnailPath: string;
}

export function isSupportedMediaMimeType(value: string): value is SupportedMediaMimeType {
  return SUPPORTED_MEDIA_MIME_TYPES.includes(value as SupportedMediaMimeType);
}

export function mimeTypeToExtension(mimeType: SupportedMediaMimeType) {
  return MIME_TO_EXTENSION[mimeType];
}

export function mimeTypeToSharpFormat(mimeType: SupportedMediaMimeType) {
  return mimeType === "image/jpeg"
    ? "jpeg"
    : mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "avif";
}

export function sharpFormatToMimeType(format: string) {
  return SHARP_FORMAT_TO_MIME_TYPE[format] ?? null;
}

export function sanitizeOriginalFilename(filename: string) {
  const baseName = path.basename(filename || "upload");
  const safeName = baseName
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return (safeName.slice(0, 180) || "upload").replace(/^(\.+)$/u, "upload");
}

export async function ensureMediaRootDirectories(mediaRoot: string) {
  await fs.mkdir(path.join(mediaRoot, "public"), { recursive: true });
  await fs.mkdir(path.join(mediaRoot, "tmp"), { recursive: true });
}

function assertPathWithinRoot(mediaRoot: string, candidatePath: string) {
  const resolvedRoot = path.resolve(mediaRoot);
  const resolvedCandidate = path.resolve(candidatePath);
  const rootPrefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;

  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(rootPrefix)) {
    throw new Error("Resolved media path escapes the media root.");
  }
}

export function getMediaAssetDirectory(mediaRoot: string, storageKey: string) {
  const safeStorageKey = normalizeMediaPathSegment(storageKey);
  const assetDir = path.resolve(mediaRoot, safeStorageKey);
  assertPathWithinRoot(mediaRoot, assetDir);
  return assetDir;
}

export function getMediaAssetFilePath(mediaRoot: string, storageKey: string, fileName: string) {
  const assetDir = getMediaAssetDirectory(mediaRoot, storageKey);
  const filePath = path.resolve(assetDir, fileName);
  assertPathWithinRoot(mediaRoot, filePath);
  return filePath;
}

export async function removeMediaAssetFiles(mediaRoot: string, storageKey: string) {
  const assetDir = getMediaAssetDirectory(mediaRoot, storageKey);
  await fs.rm(assetDir, { recursive: true, force: true });
}

export function getMediaVariantFileName(variant: MediaVariant, mimeType?: SupportedMediaMimeType) {
  if (variant === "original") {
    return `original.${mimeType ? mimeTypeToExtension(mimeType) : "jpg"}`;
  }

  return variant === "thumbnail" ? "thumbnail.webp" : "preview.webp";
}

function assertVideoContainer(buffer: Buffer, mimeType: SupportedMediaMimeType) {
  if (buffer.length < 12) {
    throw new Error("The uploaded video is too small to be a valid video file.");
  }

  if (mimeType === "video/webm") {
    // WebM/Matroska EBML magic: 1A 45 DF A3.
    const isEbml =
      buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    if (!isEbml) {
      throw new Error("The uploaded file is not a valid WebM video.");
    }
    return;
  }

  // MP4 and MOV are ISO Base Media (BMFF) files: bytes 4-7 hold the "ftyp" box.
  const brand = buffer.subarray(4, 8).toString("latin1");
  if (brand !== "ftyp") {
    throw new Error("The uploaded file is not a valid MP4/MOV video.");
  }
}

function encodeSharpImage(image: sharp.Sharp, mimeType: SupportedMediaMimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return image.jpeg({ mozjpeg: true, quality: 92 });
    case "image/png":
      return image.png({ compressionLevel: 9, adaptiveFiltering: true });
    case "image/webp":
      return image.webp({ quality: 92 });
    case "image/avif":
      return image.avif({ quality: 60 });
  }
}

export async function writeMediaAssetFiles(input: WriteMediaAssetFilesInput): Promise<WriteMediaAssetFilesResult> {
  await ensureMediaRootDirectories(input.mediaRoot);

  const storageKey = buildStorageKey(input.purpose, input.mediaId);
  const assetDir = getMediaAssetDirectory(input.mediaRoot, storageKey);
  await fs.mkdir(assetDir, { recursive: true });

  const sha256 = crypto.createHash("sha256").update(input.buffer).digest("hex");

  if (input.mimeType.startsWith("video/")) {
    assertVideoContainer(input.buffer, input.mimeType);
    const ext = input.mimeType === "video/mp4" ? "mp4" : input.mimeType === "video/webm" ? "webm" : "mov";
    const originalPath = path.join(assetDir, `original.${ext}`);
    await fs.writeFile(originalPath, input.buffer);

    return {
      mediaId: input.mediaId,
      storageKey,
      purpose: input.purpose,
      visibility: input.visibility,
      originalFilename: sanitizeOriginalFilename(input.originalFilename),
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
      widthPx: 0,
      heightPx: 0,
      sha256,
      assetDir,
      originalPath,
      previewPath: originalPath,
      thumbnailPath: originalPath,
    };
  }

  const processor = sharp(input.buffer, { failOn: "error" }).rotate();
  const metadata = await processor.metadata();
  const metadataMimeType = metadata.format ? sharpFormatToMimeType(metadata.format) : null;

  if (!metadata.width || !metadata.height || !metadata.format || !metadataMimeType) {
    throw new Error("The uploaded image could not be read.");
  }

  if (metadataMimeType !== input.mimeType) {
    throw new Error("The uploaded file type does not match its contents.");
  }

  const originalPath = path.join(assetDir, `original.${mimeTypeToExtension(input.mimeType)}`);
  const previewPath = path.join(assetDir, "preview.webp");
  const thumbnailPath = path.join(assetDir, "thumbnail.webp");

  const originalOutput = await encodeSharpImage(processor.clone(), input.mimeType)!.toBuffer({
    resolveWithObject: true,
  });
  const previewBuffer = await processor
    .clone()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const thumbnailBuffer = await processor
    .clone()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer();

  await fs.writeFile(originalPath, originalOutput.data);
  await fs.writeFile(previewPath, previewBuffer);
  await fs.writeFile(thumbnailPath, thumbnailBuffer);

  return {
    mediaId: input.mediaId,
    storageKey,
    purpose: input.purpose,
    visibility: input.visibility,
    originalFilename: sanitizeOriginalFilename(input.originalFilename),
    mimeType: input.mimeType,
    sizeBytes: input.buffer.byteLength,
    widthPx: originalOutput.info.width ?? metadata.width,
    heightPx: originalOutput.info.height ?? metadata.height,
    sha256,
    assetDir,
    originalPath,
    previewPath,
    thumbnailPath,
  };
}

export async function readMediaAssetFile(mediaRoot: string, storageKey: string, fileName: string) {
  const filePath = getMediaAssetFilePath(mediaRoot, storageKey, fileName);
  const stat = await fs.stat(filePath);
  return { filePath, stat };
}

export function getMediaContentType(fileName: string, fallbackMimeType: SupportedMediaMimeType) {
  if (fileName.endsWith(".webp")) return "image/webp";
  if (fileName.endsWith(".avif")) return "image/avif";
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
  if (fileName.endsWith(".mp4")) return "video/mp4";
  if (fileName.endsWith(".webm")) return "video/webm";
  if (fileName.endsWith(".mov")) return "video/quicktime";
  return fallbackMimeType;
}
