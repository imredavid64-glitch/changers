import { statfs } from "node:fs/promises";
import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";
import { getMediaRoot } from "@/lib/media/server";

export interface HealthCheck {
  key: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export interface PlatformHealthReport {
  ok: boolean;
  endpoint: string;
  projectId: string;
  databaseId: string;
  checkedAt: string;
  checks: HealthCheck[];
}

const apiKey = () => process.env.APPWRITE_API_KEY?.trim() || "";

async function appwriteRequest(path: string) {
  const response = await fetch(`${appwriteConfig.endpoint}${path}`, {
    headers: {
      "X-Appwrite-Project": appwriteConfig.projectId,
      "X-Appwrite-Key": apiKey(),
    },
    signal: AbortSignal.timeout(15_000),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data: data as Record<string, unknown> | null };
}

async function checkEndpointReachable(): Promise<HealthCheck> {
  try {
    const { status, data } = await appwriteRequest("/health/version");
    if (status >= 200 && status < 300) {
      return {
        key: "endpoint",
        label: "Appwrite reachable",
        status: "ok",
        detail: `${appwriteConfig.endpoint} (version ${String(data?.version ?? "?")})`,
      };
    }
    return {
      key: "endpoint",
      label: "Appwrite reachable",
      status: "fail",
      detail: `${appwriteConfig.endpoint} responded with HTTP ${status}.`,
    };
  } catch {
    return {
      key: "endpoint",
      label: "Appwrite reachable",
      status: "fail",
      detail: `Could not reach ${appwriteConfig.endpoint}. The database server may be offline.`,
    };
  }
}

async function checkStorageHealth(): Promise<HealthCheck> {
  try {
    const { status } = await appwriteRequest("/health/storage/local");
    return status < 300
      ? { key: "storage", label: "Storage volume", status: "ok", detail: "Local storage is healthy." }
      : { key: "storage", label: "Storage volume", status: "warn", detail: `Storage health reported HTTP ${status}.` };
  } catch {
    return { key: "storage", label: "Storage volume", status: "warn", detail: "Storage health check unavailable." };
  }
}

async function checkDatabaseExists(): Promise<HealthCheck> {
  try {
    const { status } = await appwriteRequest(`/databases/${appwriteConfig.databaseId}`);
    if (status >= 200 && status < 300) {
      return {
        key: "database",
        label: "Database exists",
        status: "ok",
        detail: `Database "${appwriteConfig.databaseId}" is present.`,
      };
    }
    if (status === 404) {
      return {
        key: "database",
        label: "Database exists",
        status: "fail",
        detail: `Database "${appwriteConfig.databaseId}" was not found. Data features will fail.`,
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

async function checkCollections(): Promise<HealthCheck> {
  const expected = Object.values(appwriteConfig.collections);
  try {
    const { status, data } = await appwriteRequest(`/databases/${appwriteConfig.databaseId}/collections`);
    if (status >= 400) {
      return { key: "collections", label: "Collections", status: "fail", detail: `Collections list returned HTTP ${status}.` };
    }
    const existing = new Set(
      ((data?.collections as Array<{ $id: string }>) || []).map((collection) => collection.$id),
    );
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

async function checkSchemaAttributes(): Promise<HealthCheck> {
  const profileCollection = appwriteConfig.collections.profiles;
  try {
    const { status, data } = await appwriteRequest(
      `/databases/${appwriteConfig.databaseId}/collections/${profileCollection}/attributes`,
    );
    if (status >= 400) {
      return {
        key: "schema",
        label: "Schema capacity",
        status: "fail",
        detail: `Could not read attributes for "${profileCollection}" (HTTP ${status}).`,
      };
    }
    const attributes = ((data?.attributes as Array<{ key: string; status: string }>) || []).filter(
      (attribute) => !attribute.key.startsWith("$"),
    );
    const incomplete = attributes.filter((attribute) => attribute.status === "processing");
    const failed = attributes.filter((attribute) => attribute.status === "failed");
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

async function checkMediaBucket(): Promise<HealthCheck> {
  try {
    const { status, data } = await appwriteRequest(`/storage/buckets/${appwriteConfig.mediaBucketId}`);
    if (status >= 400) {
      return {
        key: "media-bucket",
        label: "Media bucket",
        status: "fail",
        detail: `Bucket "${appwriteConfig.mediaBucketId}" was not found (HTTP ${status}). Uploads will fail.`,
      };
    }
    const maxBytes = Number((data?.maximumFileSize as number) ?? 0);
    const maxMb = Math.round(maxBytes / 1_048_576);
    return {
      key: "media-bucket",
      label: "Media bucket",
      status: "ok",
      detail: `Bucket "${appwriteConfig.mediaBucketId}" present (max ${maxMb} MB per file).`,
    };
  } catch {
    return { key: "media-bucket", label: "Media bucket", status: "warn", detail: "Media bucket check timed out." };
  }
}

async function checkMediaDisk(): Promise<HealthCheck> {
  try {
    const stats = await statfs(getMediaRoot());
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

export async function runPlatformHealthChecks(): Promise<PlatformHealthReport> {
  const checks = await Promise.all([
    checkEndpointReachable(),
    checkStorageHealth(),
    checkDatabaseExists(),
    checkCollections(),
    checkSchemaAttributes(),
    checkMediaBucket(),
    checkMediaDisk(),
  ]);

  return {
    ok: checks.every((check) => check.status === "ok"),
    endpoint: appwriteConfig.endpoint,
    projectId: appwriteConfig.projectId,
    databaseId: appwriteConfig.databaseId,
    checkedAt: new Date().toISOString(),
    checks,
  };
}

export function isPlatformHealthy(report: PlatformHealthReport) {
  return report.ok && appwriteEnabled;
}