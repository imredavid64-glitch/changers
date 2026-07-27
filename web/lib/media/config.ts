import path from "node:path";
import { type MediaPurpose } from "./types";

const DEFAULT_MEDIA_ROOT = path.resolve(process.cwd(), "..", ".changers-media");
const DEFAULT_MEDIA_FREE_SPACE_GUARD_BYTES = 20 * 1024 * 1024 * 1024;
const DEFAULT_MEDIA_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getMediaRootDir() {
  return process.env.MEDIA_ROOT?.trim() || DEFAULT_MEDIA_ROOT;
}

export function getMediaPublicPrefix() {
  return (process.env.MEDIA_PUBLIC_PREFIX?.trim() || "media").replace(/^\/+|\/+$/g, "");
}

export function getMediaDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || "";
}

export function getMediaFreeSpaceGuardBytes() {
  return parsePositiveInteger(process.env.MEDIA_FREE_SPACE_GUARD_BYTES, DEFAULT_MEDIA_FREE_SPACE_GUARD_BYTES);
}

export function getMediaMaxUploadBytes() {
  return parsePositiveInteger(process.env.MEDIA_MAX_UPLOAD_BYTES, DEFAULT_MEDIA_MAX_UPLOAD_BYTES);
}

export function getPurposeFolder(purpose: MediaPurpose) {
  switch (purpose) {
    case "avatar":
      return "avatars";
    case "post":
      return "posts";
    case "attachment":
      return "attachments";
    default:
      return "misc";
  }
}

export function normalizeMediaPathSegment(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..")
    .join("/");
}

export function buildStorageKey(purpose: MediaPurpose, mediaId: string) {
  return path.posix.join("public", getPurposeFolder(purpose), mediaId);
}

export function buildMediaPath(storageKey: string, variantFileName: string) {
  const publicPrefix = getMediaPublicPrefix();
  const safeStorageKey = normalizeMediaPathSegment(storageKey);
  return `/${publicPrefix}/${safeStorageKey}/${variantFileName}`.replace(/\/{2,}/g, "/");
}

export function buildMediaUrl(storageKey: string, variantFileName: string, baseUrl = "") {
  const mediaPath = buildMediaPath(storageKey, variantFileName);
  if (!baseUrl) return mediaPath;
  return new URL(mediaPath, baseUrl).toString();
}
