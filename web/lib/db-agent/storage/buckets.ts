import { getBucket, createBucket } from "../client";
import { dbAgentConfig } from "../config";
import type { BucketInfo } from "../types";

export async function ensureMediaBucket(): Promise<BucketInfo | null> {
  const bucketId = dbAgentConfig.appwrite.mediaBucketId;
  
  try {
    const existing = await getBucket(bucketId);
    if (existing) {
      console.log(`⏭️  Bucket "${bucketId}" already exists`);
      return existing;
    }
  } catch (error) {
    console.error(`Error checking bucket:`, error);
  }

  console.log(`📦 Creating bucket: ${bucketId}`);
  
  const permissions = [
    "read(\"users\")",
    "write(\"users\")",
    "create(\"users\")",
    "delete(\"users\")",
    "update(\"users\")",
  ];

  try {
    const bucket = await createBucket(
      bucketId,
      bucketId,
      permissions,
      false, // fileSecurity
      true,  // enabled
      104857600, // 100 MB max file size
      ["image/*", "video/*", "application/pdf", "audio/*"], // allowed extensions
      "gzip", // compression
      false  // encryption
    );
    
    console.log(`✅ Bucket "${bucketId}" created successfully`);
    return bucket;
  } catch (error) {
    console.error(`❌ Failed to create bucket:`, error);
    return null;
  }
}

export async function getBucketInfo(bucketId?: string): Promise<BucketInfo | null> {
  const id = bucketId || dbAgentConfig.appwrite.mediaBucketId;
  return getBucket(id);
}

export async function updateBucketSettings(
  bucketId: string,
  settings: {
    maximumFileSize?: number;
    allowedFileExtensions?: string[];
    compression?: string;
    encryption?: boolean;
    enabled?: boolean;
  }
): Promise<void> {
  // Appwrite doesn't have a direct update bucket API via REST
  // This would require using the Appwrite SDK or console
  console.log(`Bucket update not implemented via REST API. Use Appwrite Console for:`, settings);
}