import { dbAgentConfig, getAppwriteHeaders, getAppwriteUrl } from "./config";
import type { CollectionInfo, AttributeInfo, IndexInfo, BucketInfo, AttributeLimitStatus } from "./types";

const TIMEOUT_MS = 15_000;

async function appwriteRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; data: T | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(getAppwriteUrl(path), {
      ...options,
      headers: {
        ...getAppwriteHeaders(),
        ...options.headers,
      },
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

export async function listCollections(): Promise<CollectionInfo[]> {
  const { status, data } = await appwriteRequest<{ collections: CollectionInfo[]; total: number }>(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections`
  );
  if (status >= 400) {
    throw new Error(`Failed to list collections: HTTP ${status}`);
  }
  return data?.collections || [];
}

export async function getCollection(collectionId: string): Promise<CollectionInfo | null> {
  const { status, data } = await appwriteRequest<CollectionInfo>(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}`
  );
  if (status === 404) return null;
  if (status >= 400) {
    throw new Error(`Failed to get collection: HTTP ${status}`);
  }
  return data;
}

export async function createCollection(
  collectionId: string,
  name: string,
  permissions: readonly string[] = [],
  documentSecurity = false,
  enabled = true
): Promise<CollectionInfo> {
  const { status, data } = await appwriteRequest<CollectionInfo>(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections`,
    {
      method: "POST",
      body: JSON.stringify({
        collectionId,
        name,
        permissions,
        documentSecurity,
        enabled,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create collection: HTTP ${status}`);
  }
  if (!data) throw new Error("No data returned from create collection");
  return data;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}`,
    { method: "DELETE" }
  );
  if (status >= 400) {
    throw new Error(`Failed to delete collection: HTTP ${status}`);
  }
}

export async function listAttributes(collectionId: string): Promise<AttributeInfo[]> {
  const { status, data } = await appwriteRequest<{ attributes: AttributeInfo[] }>(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes`
  );
  if (status >= 400) {
    throw new Error(`Failed to list attributes: HTTP ${status}`);
  }
  return data?.attributes || [];
}

export async function createStringAttribute(
  collectionId: string,
  key: string,
  size: number,
  required: boolean,
  defaultValue?: string,
  array = false,
  enumValues?: readonly string[]
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/string`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        size,
        required,
        default: defaultValue ?? null,
        array,
        enum: enumValues ?? null,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create string attribute: HTTP ${status}`);
  }
}

export async function createIntegerAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: number,
  min?: number,
  max?: number,
  array = false
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/integer`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        required,
        default: defaultValue ?? null,
        min: min ?? null,
        max: max ?? null,
        array,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create integer attribute: HTTP ${status}`);
  }
}

export async function createBooleanAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: boolean,
  array = false
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/boolean`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        required,
        default: defaultValue ?? null,
        array,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create boolean attribute: HTTP ${status}`);
  }
}

export async function createJsonAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  array = false
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/json`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        required,
        array,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create JSON attribute: HTTP ${status}`);
  }
}

export async function createFloatAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: number,
  min?: number,
  max?: number,
  array = false
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/float`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        required,
        default: defaultValue ?? null,
        min: min ?? null,
        max: max ?? null,
        array,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create float attribute: HTTP ${status}`);
  }
}

export async function createEmailAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: string,
  array = false
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/email`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        required,
        default: defaultValue ?? null,
        array,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create email attribute: HTTP ${status}`);
  }
}

export async function createUrlAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: string,
  array = false
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/url`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        required,
        default: defaultValue ?? null,
        array,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create URL attribute: HTTP ${status}`);
  }
}

export async function createDatetimeAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: string,
  array = false
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/datetime`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        required,
        default: defaultValue ?? null,
        array,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create datetime attribute: HTTP ${status}`);
  }
}

export async function createRelationshipAttribute(
  collectionId: string,
  key: string,
  relatedCollectionId: string,
  type: "oneToOne" | "oneToMany" | "manyToMany",
  twoWay: boolean,
  keyOnRelated?: string,
  onDelete?: "cascade" | "restrict" | "setNull"
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/relationship`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        relatedCollection: relatedCollectionId,
        type,
        twoWay,
        keyOnRelated: keyOnRelated ?? null,
        onDelete: onDelete ?? "cascade",
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create relationship attribute: HTTP ${status}`);
  }
}

export async function deleteAttribute(collectionId: string, key: string): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/attributes/${key}`,
    { method: "DELETE" }
  );
  if (status >= 400 && status !== 404) {
    throw new Error(`Failed to delete attribute: HTTP ${status}`);
  }
}

export async function waitForAttribute(
  collectionId: string,
  key: string,
  maxWaitMs = 30_000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const attrs = await listAttributes(collectionId);
      const found = attrs.find((a) => a.key === key && a.status === "available");
      if (found) return true;
    } catch {
      // ignore errors, keep polling
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

export async function listIndexes(collectionId: string): Promise<IndexInfo[]> {
  const { status, data } = await appwriteRequest<{ indexes: IndexInfo[] }>(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/indexes`
  );
  if (status >= 400) {
    throw new Error(`Failed to list indexes: HTTP ${status}`);
  }
  return data?.indexes || [];
}

export async function createIndex(
  collectionId: string,
  key: string,
  type: "key" | "fulltext",
  attributes: readonly string[]
): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/indexes`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        type,
        attributes,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create index: HTTP ${status}`);
  }
}

export async function deleteIndex(collectionId: string, key: string): Promise<void> {
  const { status } = await appwriteRequest(
    `/databases/${dbAgentConfig.appwrite.databaseId}/collections/${collectionId}/indexes/${key}`,
    { method: "DELETE" }
  );
  if (status >= 400 && status !== 404) {
    throw new Error(`Failed to delete index: HTTP ${status}`);
  }
}

export async function getBucket(bucketId: string): Promise<BucketInfo | null> {
  const { status, data } = await appwriteRequest<BucketInfo>(`/storage/buckets/${bucketId}`);
  if (status === 404) return null;
  if (status >= 400) {
    throw new Error(`Failed to get bucket: HTTP ${status}`);
  }
  return data;
}

export async function createBucket(
  bucketId: string,
  name: string,
  permissions: string[] = [],
  fileSecurity = false,
  enabled = true,
  maximumFileSize = 104857600,
  allowedFileExtensions: string[] = [],
  compression = "gzip",
  encryption = false
): Promise<BucketInfo> {
  const { status, data } = await appwriteRequest<BucketInfo>(
    `/storage/buckets`,
    {
      method: "POST",
      body: JSON.stringify({
        bucketId,
        name,
        permissions,
        fileSecurity,
        enabled,
        maximumFileSize,
        allowedFileExtensions,
        compression,
        encryption,
      }),
    }
  );
  if (status >= 400) {
    throw new Error(`Failed to create bucket: HTTP ${status}`);
  }
  if (!data) throw new Error("No data returned from create bucket");
  return data;
}

export async function getAttributeLimitStatus(collectionId: string): Promise<AttributeLimitStatus> {
  const attrs = await listAttributes(collectionId);
  const currentCount = attrs.filter((a) => !a.key.startsWith("$")).length;
  const maxCount = dbAgentConfig.limits.maxAttributesPerCollection;
  return {
    collectionId,
    currentCount,
    maxCount,
    remaining: maxCount - currentCount,
    atLimit: currentCount >= maxCount,
  };
}

export async function checkHealth(): Promise<{ status: number; version?: string }> {
  const { status, data } = await appwriteRequest<{ version: string }>("/health/version");
  return { status, version: data?.version };
}