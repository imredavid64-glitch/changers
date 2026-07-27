import { statfs } from "node:fs/promises";
import { Account, Client } from "appwrite";
import { Pool } from "pg";
import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";
import { MEDIA_SCHEMA_SQL } from "./schema";
import {
  getMediaDatabaseUrl,
  getMediaFreeSpaceGuardBytes,
  getMediaRootDir,
} from "./config";
import type { MediaAssetRecord, MediaPurpose, MediaVisibility, SupportedMediaMimeType } from "./types";
import { ensureMediaRootDirectories } from "./storage";

interface MediaAssetDbRow {
  id: string;
  owner_user_id: string;
  purpose: string;
  visibility: string;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: string | number;
  width_px: string | number;
  height_px: string | number;
  sha256: string;
  created_at: string | Date;
  deleted_at: string | Date | null;
}

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function getMediaRoot() {
  return getMediaRootDir();
}

export function getMediaPool() {
  if (!pool) {
    const connectionString = getMediaDatabaseUrl();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for media storage.");
    }

    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }

  return pool;
}

export async function ensureMediaSchema() {
  if (!schemaReady) {
    schemaReady = getMediaPool().query(MEDIA_SCHEMA_SQL).then(() => undefined);
  }

  return schemaReady;
}

function mapMediaAssetRow(row: MediaAssetDbRow): MediaAssetRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    purpose: row.purpose as MediaPurpose,
    visibility: row.visibility as MediaVisibility,
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type as SupportedMediaMimeType,
    sizeBytes: Number(row.size_bytes),
    widthPx: Number(row.width_px),
    heightPx: Number(row.height_px),
    sha256: row.sha256,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    deletedAt: row.deleted_at
      ? row.deleted_at instanceof Date
        ? row.deleted_at.toISOString()
        : String(row.deleted_at)
      : null,
  };
}

export async function insertMediaAsset(record: MediaAssetRecord) {
  const { rows } = await getMediaPool().query<MediaAssetDbRow>(
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      record.id,
      record.ownerUserId,
      record.purpose,
      record.visibility,
      record.storageKey,
      record.originalFilename,
      record.mimeType,
      record.sizeBytes,
      record.widthPx,
      record.heightPx,
      record.sha256,
    ],
  );

  return mapMediaAssetRow(rows[0]);
}

export async function getMediaAssetById(id: string) {
  const { rows } = await getMediaPool().query<MediaAssetDbRow>(
    `
      SELECT *
      FROM media_assets
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapMediaAssetRow(rows[0]) : null;
}

export async function getMediaAssetByStorageKey(storageKey: string) {
  const { rows } = await getMediaPool().query<MediaAssetDbRow>(
    `
      SELECT *
      FROM media_assets
      WHERE storage_key = $1
      LIMIT 1
    `,
    [storageKey],
  );

  return rows[0] ? mapMediaAssetRow(rows[0]) : null;
}

export async function softDeleteMediaAsset(id: string) {
  const { rows } = await getMediaPool().query<MediaAssetDbRow>(
    `
      UPDATE media_assets
      SET deleted_at = COALESCE(deleted_at, now())
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return rows[0] ? mapMediaAssetRow(rows[0]) : null;
}

export async function assertMediaFreeSpace() {
  const mediaRoot = getMediaRoot();
  const guardBytes = getMediaFreeSpaceGuardBytes();
  await ensureMediaRootDirectories(mediaRoot);
  const stats = await statfs(mediaRoot);
  const availableBytes = Number(stats.bavail) * Number(stats.bsize || 0);

  if (availableBytes < guardBytes) {
    throw new Error("Uploads are paused until the media volume has at least 20 GB free.");
  }
}

export async function getAuthenticatedAppwriteUser(request: Request) {
  if (!appwriteEnabled) {
    throw new Error("Appwrite is not configured.");
  }

  const authorization = request.headers.get("authorization") || "";
  const jwt = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!jwt) {
    return null;
  }

  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setJWT(jwt);

  const account = new Account(client);

  try {
    return await account.get();
  } catch {
    return null;
  }
}
