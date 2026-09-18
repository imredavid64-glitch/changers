import { dbAgentConfig, getAppwriteHeaders, getAppwriteUrl } from "../config";
import { listCollections, listAttributes, listIndexes, getBucket, getAttributeLimitStatus } from "../client";
import type { HealthCheck } from "../types";

const TIMEOUT_MS = 15_000;

async function appwriteRequest<T>(path: string): Promise<{ status: number; data: T | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(getAppwriteUrl(path), {
      headers: getAppwriteHeaders(),
      signal: controller.signal,
    });

    let data: T | null = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { status: response.status, data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkEndpointReachable(): Promise<HealthCheck> {
  try {
    const { status, data } = await appwriteRequest<{ status?: string }>("/health");
    if (status >= 200 && status < 300) {
      return {
        key: "endpoint",
        label: "Appwrite reachable",
        status: "ok",
        detail: `${dbAgentConfig.appwrite.endpoint} (health: ${String(data?.status ?? "?")})`,
      };
    }
    return {
      key: "endpoint",
      label: "Appwrite reachable",
      status: "fail",
      detail: `${dbAgentConfig.appwrite.endpoint} responded with HTTP ${status}.`,
    };
  } catch {
    return {
      key: "endpoint",
      label: "Appwrite reachable",
      status: "fail",
      detail: `Could not reach ${dbAgentConfig.appwrite.endpoint}. The database server may be offline.`,
    };
  }
}

export async function checkStorageHealth(): Promise<HealthCheck> {
  try {
    const { status } = await appwriteRequest("/health/storage/local");
    return status < 300
      ? { key: "storage", label: "Storage volume", status: "ok", detail: "Local storage is healthy." }
      : { key: "storage", label: "Storage volume", status: "warn", detail: `Storage health reported HTTP ${status}.` };
  } catch {
    return { key: "storage", label: "Storage volume", status: "warn", detail: "Storage health check unavailable." };
  }
}

export async function checkDatabaseExists(): Promise<HealthCheck> {
  try {
    const { status } = await appwriteRequest(`/databases/${dbAgentConfig.appwrite.databaseId}`);
    if (status >= 200 && status < 300) {
      return {
        key: "database",
        label: "Database exists",
        status: "ok",
        detail: `Database "${dbAgentConfig.appwrite.databaseId}" is present.`,
      };
    }
    if (status === 404) {
      return {
        key: "database",
        label: "Database exists",
        status: "fail",
        detail: `Database "${dbAgentConfig.appwrite.databaseId}" was not found. Data features will fail.`,
      };
    }
    return {
      key: "database",
      label: "Database exists",
      status: "fail",
      detail: `Database check returned HTTP ${status}.`,
    };
  } catch {
    return { key: "database", label: "Database exists", status: "fail", detail: "Database check timed out." };
  }
}

export async function checkCollections(): Promise<HealthCheck> {
  const expected = Object.values(dbAgentConfig.appwrite.collections);
  try {
    const collections = await listCollections();
    const existing = new Set(collections.map((c) => c.$id));
    const missing = expected.filter((id) => !existing.has(id));
    if (missing.length === 0) {
      return { key: "collections", label: "Collections", status: "ok", detail: `All ${expected.length} collections present.` };
    }
    return {
      key: "collections",
      label: "Collections",
      status: "fail",
      detail: `Missing ${missing.length} collection(s): ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}.`,
    };
  } catch {
    return { key: "collections", label: "Collections", status: "fail", detail: "Collections check timed out." };
  }
}

export async function checkSchemaAttributes(): Promise<HealthCheck> {
  const profileCollection = dbAgentConfig.appwrite.collections.profiles;
  try {
    const attrs = await listAttributes(profileCollection);
    const attributes = attrs.filter((a) => !a.key.startsWith("$"));
    const incomplete = attributes.filter((a) => a.status === "processing");
    const failed = attributes.filter((a) => a.status === "failed");
    if (failed.length > 0) {
      return {
        key: "schema",
        label: "Schema capacity",
        status: "fail",
        detail: `${failed.length} attribute(s) on "${profileCollection}" failed to create: ${failed.map((a) => a.key).join(", ")}.`,
      };
    }
    if (incomplete.length > 0) {
      return {
        key: "schema",
        label: "Schema capacity",
        status: "warn",
        detail: `${incomplete.length} attribute(s) on "${profileCollection}" are still processing.`,
      };
    }
    return {
      key: "schema",
      label: "Schema capacity",
      status: "ok",
      detail: `"${profileCollection}" has ${attributes.length} usable attributes.`,
    };
  } catch {
    return { key: "schema", label: "Schema capacity", status: "warn", detail: "Schema attribute check timed out." };
  }
}

export async function checkMediaBucket(): Promise<HealthCheck> {
  try {
    const bucket = await getBucket(dbAgentConfig.appwrite.mediaBucketId);
    if (!bucket) {
      return {
        key: "media-bucket",
        label: "Media bucket",
        status: "fail",
        detail: `Bucket "${dbAgentConfig.appwrite.mediaBucketId}" was not found. Uploads will fail.`,
      };
    }
    const maxMb = Math.round(bucket.maximumFileSize / 1_048_576);
    return {
      key: "media-bucket",
      label: "Media bucket",
      status: "ok",
      detail: `Bucket "${bucket.$id}" present (max ${maxMb} MB per file).`,
    };
  } catch {
    return { key: "media-bucket", label: "Media bucket", status: "warn", detail: "Media bucket check timed out." };
  }
}

export async function checkMediaDisk(): Promise<HealthCheck> {
  try {
    const stats = await (await import("node:fs/promises")).statfs(process.env.MEDIA_ROOT || ".changers-media");
    const availableBytes = Number(stats.bavail) * Number(stats.bsize || 0);
    const availableGb = availableBytes / 1_073_741_824;
    if (availableGb < 20) {
      return {
        key: "media-disk",
        label: "Media disk space",
        status: availableGb < 5 ? "fail" : "warn",
        detail: `Only ${availableGb.toFixed(1)} GB free — uploads pause below 20 GB.`,
      };
    }
    return {
      key: "media-disk",
      label: "Media disk space",
      status: "ok",
      detail: `${availableGb.toFixed(1)} GB free on the media volume.`,
    };
  } catch {
    return {
      key: "media-disk",
      label: "Media disk space",
      status: "ok",
      detail: "Media volume not configured on this instance.",
    };
  }
}

export async function checkAttributeLimits(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const collections = await listCollections();
  
  for (const col of collections) {
    try {
      const limitStatus = await getAttributeLimitStatus(col.$id);
      const pct = (limitStatus.currentCount / limitStatus.maxCount) * 100;
      
      if (limitStatus.atLimit) {
        checks.push({
          key: `attr-limit-${col.$id}`,
          label: `Attribute limit: ${col.name}`,
          status: "fail",
          detail: `Collection "${col.name}" at attribute limit (${limitStatus.currentCount}/${limitStatus.maxCount}). Cannot add new attributes.`,
        });
      } else if (pct >= dbAgentConfig.limits.attributeLimitWarningThreshold) {
        checks.push({
          key: `attr-limit-${col.$id}`,
          label: `Attribute limit: ${col.name}`,
          status: "warn",
          detail: `Collection "${col.name}" at ${pct.toFixed(0)}% attribute capacity (${limitStatus.currentCount}/${limitStatus.maxCount}).`,
        });
      } else {
        checks.push({
          key: `attr-limit-${col.$id}`,
          label: `Attribute limit: ${col.name}`,
          status: "ok",
          detail: `Collection "${col.name}" has ${limitStatus.remaining} attribute slots available.`,
        });
      }
    } catch {
      checks.push({
        key: `attr-limit-${col.$id}`,
        label: `Attribute limit: ${col.name}`,
        status: "warn",
        detail: "Could not check attribute limit.",
      });
    }
  }
  
  return checks;
}

export async function checkIndexStatus(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const collections = await listCollections();
  
  for (const col of collections) {
    try {
      const indexes = await listIndexes(col.$id);
      const processing = indexes.filter((i) => i.status === "processing");
      const failed = indexes.filter((i) => i.status === "failed");
      
      if (failed.length > 0) {
        checks.push({
          key: `index-status-${col.$id}`,
          label: `Index status: ${col.name}`,
          status: "fail",
          detail: `${failed.length} index(es) failed: ${failed.map((i) => i.key).join(", ")}.`,
        });
      } else if (processing.length > 0) {
        checks.push({
          key: `index-status-${col.$id}`,
          label: `Index status: ${col.name}`,
          status: "warn",
          detail: `${processing.length} index(es) still processing: ${processing.map((i) => i.key).join(", ")}.`,
        });
      } else if (indexes.length > 0) {
        checks.push({
          key: `index-status-${col.$id}`,
          label: `Index status: ${col.name}`,
          status: "ok",
          detail: `All ${indexes.length} index(es) available.`,
        });
      }
    } catch {
      // Silently skip if index check fails
    }
  }
  
  return checks;
}

export async function checkPostgresConnection(): Promise<HealthCheck> {
  const pgUrl = dbAgentConfig.postgres.url;
  if (!pgUrl) {
    return {
      key: "postgres",
      label: "PostgreSQL connection",
      status: "warn",
      detail: "DATABASE_URL not configured. Media migration unavailable.",
    };
  }
  
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: pgUrl, max: 1 });
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    await pool.end();
    
    return {
      key: "postgres",
      label: "PostgreSQL connection",
      status: "ok",
      detail: "PostgreSQL connection successful.",
    };
  } catch (error) {
    return {
      key: "postgres",
      label: "PostgreSQL connection",
      status: "fail",
      detail: `PostgreSQL connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}