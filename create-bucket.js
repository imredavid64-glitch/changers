#!/usr/bin/env node
/**
 * Create storage bucket for Changers platform.
 */

import { Client, Storage, Permission, Role } from "node-appwrite";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_MEDIA_BUCKET_ID || "changers-media";

if (!projectId || !apiKey) {
  console.error("❌ Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY in .env.local");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const storage = new Storage(client);

const permissions = [
  Permission.read(Role.users()),
  Permission.write(Role.users()),
  Permission.create(Role.users()),
  Permission.delete(Role.users()),
  Permission.update(Role.users()),
];

async function main() {
  console.log("🚀 Creating storage bucket...\n");
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log(`📦 Bucket: ${bucketId}\n`);

  try {
    // Check if exists
    try {
      const bucket = await storage.getBucket(bucketId);
      console.log(`⏭️  Bucket "${bucketId}" already exists:`, bucket.name);
      return;
    } catch (e) {
      if (e.code !== 404) throw e;
    }

    console.log(`📦 Creating bucket: ${bucketId}`);
    const bucket = await storage.createBucket(
      bucketId,
      bucketId,
      permissions,
      false, // fileSecurity
      undefined, // enabled
      104857600, // maxFileSize (100 MB)
      ["image/*", "video/*", "application/pdf", "audio/*"], // allowedFileExtensions
      3600, // compression (1 hour)
      false // encryption
    );

    console.log(`✅ Bucket "${bucketId}" created successfully!`);
    console.log(`   Max file size: 100 MB`);
    console.log(`   Allowed types: image/*, video/*, application/pdf, audio/*`);
  } catch (error) {
    console.error(`❌ Failed to create bucket:`, error.message);
    process.exit(1);
  }
}

main().catch(console.error);