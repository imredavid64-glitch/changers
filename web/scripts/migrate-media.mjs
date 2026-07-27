#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Client, Databases, Query, Storage } from "appwrite";
import { Pool } from "pg";

const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.replace(/\/$/, "");
const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim();
const appwriteApiKey = process.env.APPWRITE_API_KEY?.trim();
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID?.trim() || "bridge";
const mediaBucketId = process.env.NEXT_PUBLIC_APPWRITE_MEDIA_BUCKET_ID?.trim() || "bridge-media";
const mediaRoot = process.env.MEDIA_ROOT?.trim() || path.resolve(process.cwd(), "..", ".bridge-media");
const publicBaseUrl = process.env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || "";
const postgresUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();

if (!appwriteEndpoint || !appwriteProjectId || !appwriteApiKey) {
  throw new Error(
    "Set NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, and APPWRITE_API_KEY.",
  );
}

if (!postgresUrl) {
  throw new Error("Set DATABASE_URL for the Dell PC Postgres instance.");
}

const client = new Client()
  .setEndpoint(appwriteEndpoint)
  .setProject(appwriteProjectId)
  .setKey(appwriteApiKey);

const databases = new Databases(client);
const storage = new Storage(client);
const pool = new Pool({ connectionString: postgresUrl });
const legacyMediaCache = new Map();

const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function normalizeMimeType(value) {
  return String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function isSupportedMimeType(value) {
  return supportedMimeTypes.has(normalizeMimeType(value));
}

function mimeTypeToExtension(mimeType) {
  switch (normalizeMimeType(mimeType)) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/jpeg":
    default:
      return "jpg";
  }
}

function sanitizeOriginalFilename(filename) {
  const baseName = path.basename(String(filename || "upload"));
  const safeName = baseName
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return safeName.slice(0, 180) || "upload";
}

function getPurposeFolder(purpose) {
  return purpose === "post" ? "posts" : purpose === "avatar" ? "avatars" : "misc";
}

function buildStorageKey(purpose, mediaId) {
  return path.posix.join("public", getPurposeFolder(purpose), mediaId);
}

function buildPublicMediaUrl(storageKey, variantFileName = "preview.webp") {
  const routePath = `/media/${storageKey}/${variantFileName}`.replace(/\/{2,}/g, "/");
  return publicBaseUrl ? `${publicBaseUrl}${routePath}` : routePath;
}

async function ensureMediaSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id text PRIMARY KEY,
      owner_user_id text NOT NULL,
      purpose text NOT NULL,
      visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
      storage_key text NOT NULL UNIQUE,
      original_filename text NOT NULL,
      mime_type text NOT NULL,
      size_bytes bigint NOT NULL CHECK (size_bytes > 0),
      width_px integer NOT NULL CHECK (width_px > 0),
      height_px integer NOT NULL CHECK (height_px > 0),
      sha256 text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
}

async function ensureMediaRootDirectories() {
  await fs.mkdir(path.join(mediaRoot, "public"), { recursive: true });
  await fs.mkdir(path.join(mediaRoot, "tmp"), { recursive: true });
}

function encodeSharpImage(image, mimeType) {
  switch (normalizeMimeType(mimeType)) {
    case "image/png":
      return image.png({ compressionLevel: 9, adaptiveFiltering: true });
    case "image/webp":
      return image.webp({ quality: 92 });
    case "image/avif":
      return image.avif({ quality: 60 });
    case "image/jpeg":
    default:
      return image.jpeg({ mozjpeg: true, quality: 92 });
  }
}

async function writeImportedMediaAsset({
  mediaId,
  purpose,
  ownerUserId,
  mimeType,
  buffer,
  originalFilename,
}) {
  await ensureMediaRootDirectories();

  const normalizedMimeType = normalizeMimeType(mimeType);
  if (!isSupportedMimeType(normalizedMimeType)) {
    throw new Error(`Unsupported migrated media type: ${mimeType}`);
  }

  const storageKey = buildStorageKey(purpose, mediaId);
  const assetDir = path.resolve(mediaRoot, storageKey);
  await fs.mkdir(assetDir, { recursive: true });

  const processor = sharp(buffer, { failOn: "error" }).rotate();
  const metadata = await processor.metadata();
  const output = await encodeSharpImage(processor.clone(), normalizedMimeType).toBuffer({
    resolveWithObject: true,
  });

  const widthPx = output.info.width ?? metadata.width ?? 0;
  const heightPx = output.info.height ?? metadata.height ?? 0;
  if (!widthPx || !heightPx) {
    throw new Error("Imported image dimensions could not be read.");
  }

  const originalPath = path.join(assetDir, `original.${mimeTypeToExtension(normalizedMimeType)}`);
  const previewPath = path.join(assetDir, "preview.webp");
  const thumbnailPath = path.join(assetDir, "thumbnail.webp");

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

  await fs.writeFile(originalPath, output.data);
  await fs.writeFile(previewPath, previewBuffer);
  await fs.writeFile(thumbnailPath, thumbnailBuffer);

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const sizeBytes = buffer.byteLength;
  const safeOriginalFilename = sanitizeOriginalFilename(originalFilename);

  await pool.query(
    `
      INSERT INTO media_assets (
        id,
        owner_user_id,
        purpose,
        visibility,
        storage_key,
        original_filename,
        mime_type,
        size_bytes,
        width_px,
        height_px,
        sha256
      )
      VALUES ($1, $2, $3, 'public', $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      mediaId,
      ownerUserId,
      purpose,
      storageKey,
      safeOriginalFilename,
      normalizedMimeType,
      sizeBytes,
      widthPx,
      heightPx,
      sha256,
    ],
  );

  return {
    mediaId,
    storageKey,
    mimeType: normalizedMimeType,
    originalFilename: safeOriginalFilename,
    sizeBytes,
    widthPx,
    heightPx,
    sha256,
    previewUrl: buildPublicMediaUrl(storageKey, "preview.webp"),
    thumbnailUrl: buildPublicMediaUrl(storageKey, "thumbnail.webp"),
    originalUrl: buildPublicMediaUrl(
      storageKey,
      `original.${mimeTypeToExtension(normalizedMimeType)}`,
    ),
  };
}

function parseFilenameFromDisposition(disposition, fallback) {
  const match = /filename="?([^"]+)"?/i.exec(String(disposition || ""));
  return sanitizeOriginalFilename(match?.[1] || fallback);
}

async function downloadLegacyFile(fileId, fallbackFilename) {
  const downloadUrl = storage.getFileDownload(mediaBucketId, fileId);
  const response = await fetch(downloadUrl, {
    headers: {
      "X-Appwrite-Key": appwriteApiKey,
      "X-Appwrite-Project": appwriteProjectId,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download legacy file ${fileId}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = normalizeMimeType(response.headers.get("content-type"));
  const originalFilename = parseFilenameFromDisposition(
    response.headers.get("content-disposition"),
    fallbackFilename || fileId,
  );

  return { buffer, mimeType, originalFilename };
}

async function migrateLegacyFile({
  legacyFileId,
  purpose,
  ownerUserId,
  fallbackFilename,
}) {
  if (!legacyFileId) return null;

  if (legacyMediaCache.has(legacyFileId)) {
    return legacyMediaCache.get(legacyFileId);
  }

  const download = await downloadLegacyFile(legacyFileId, fallbackFilename);
  const mediaId = crypto.randomUUID();
  const asset = await writeImportedMediaAsset({
    mediaId,
    purpose,
    ownerUserId,
    mimeType: download.mimeType,
    buffer: download.buffer,
    originalFilename: download.originalFilename,
  });

  legacyMediaCache.set(legacyFileId, asset);
  return asset;
}

async function migrateProfileDocument(document) {
  const legacyAvatarFileId = String(document.avatar_file_id || "");
  const ownerUserId = String(document.user_id || document.$id);

  if (!legacyAvatarFileId) {
    return;
  }

  const asset = await migrateLegacyFile({
    legacyFileId: legacyAvatarFileId,
    purpose: "avatar",
    ownerUserId,
    fallbackFilename: `${ownerUserId}-avatar`,
  });

  if (!asset) return;

  await databases.updateDocument({
    databaseId,
    collectionId: "profiles",
    documentId: document.$id,
    data: {
      avatar_file_id: "",
      avatar_media_id: asset.mediaId,
      avatar_media_storage_key: asset.storageKey,
      avatar_media_url: asset.previewUrl,
      avatar_url: asset.previewUrl,
    },
  });
}

async function migratePostDocument(document) {
  const authorId = String(document.author_id || "");
  const legacyImageFileId = String(document.image_file_id || "");
  const legacyAuthorAvatarFileId = String(document.author_avatar_file_id || "");

  const updates = {};

  if (legacyImageFileId) {
    const asset = await migrateLegacyFile({
      legacyFileId: legacyImageFileId,
      purpose: "post",
      ownerUserId: authorId || String(document.$id),
      fallbackFilename: `${document.$id}-image`,
    });

    if (asset) {
      updates.image_file_id = "";
      updates.image_media_id = asset.mediaId;
      updates.image_media_storage_key = asset.storageKey;
      updates.image_media_url = asset.previewUrl;
      updates.image_url = asset.previewUrl;
    }
  }

  if (legacyAuthorAvatarFileId) {
    const asset = await migrateLegacyFile({
      legacyFileId: legacyAuthorAvatarFileId,
      purpose: "avatar",
      ownerUserId: authorId || String(document.$id),
      fallbackFilename: `${authorId || document.$id}-avatar`,
    });

    if (asset) {
      updates.author_avatar_file_id = "";
      updates.author_avatar_media_id = asset.mediaId;
      updates.author_avatar_media_storage_key = asset.storageKey;
      updates.author_avatar_media_url = asset.previewUrl;
      updates.author_avatar_url = asset.previewUrl;
    }
  }

  if (Object.keys(updates).length > 0) {
    await databases.updateDocument({
      databaseId,
      collectionId: "posts",
      documentId: document.$id,
      data: updates,
    });
  }
}

async function migrateCommentDocument(document) {
  const authorId = String(document.author_id || "");
  const legacyAvatarFileId = String(document.author_avatar_file_id || "");

  if (!legacyAvatarFileId) {
    return;
  }

  const asset = await migrateLegacyFile({
    legacyFileId: legacyAvatarFileId,
    purpose: "avatar",
    ownerUserId: authorId || String(document.$id),
    fallbackFilename: `${authorId || document.$id}-avatar`,
  });

  if (!asset) return;

  await databases.updateDocument({
    databaseId,
    collectionId: "comments",
    documentId: document.$id,
    data: {
      author_avatar_file_id: "",
      author_avatar_media_id: asset.mediaId,
      author_avatar_media_storage_key: asset.storageKey,
      author_avatar_media_url: asset.previewUrl,
      author_avatar_url: asset.previewUrl,
    },
  });
}

async function migrateCollection(collectionId, handler) {
  let offset = 0;

  while (true) {
    const list = await databases.listDocuments({
      databaseId,
      collectionId,
      queries: [Query.limit(100), Query.offset(offset)],
      total: false,
    });

    if (!list.documents.length) {
      break;
    }

    for (const document of list.documents) {
      try {
        await handler(document);
        console.log(`Migrated ${collectionId.slice(0, -1)} ${document.$id}`);
      } catch (error) {
        console.error(`Migration failed for ${collectionId}/${document.$id}`, error);
      }
    }

    offset += list.documents.length;
  }
}

async function main() {
  await ensureMediaSchema();
  await ensureMediaRootDirectories();

  await migrateCollection("profiles", migrateProfileDocument);
  await migrateCollection("posts", migratePostDocument);
  await migrateCollection("comments", migrateCommentDocument);

  console.log("Media migration finished.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

