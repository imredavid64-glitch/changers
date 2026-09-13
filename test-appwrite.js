#!/usr/bin/env node
/**
 * Test Appwrite connection and health checks
 */

import { Client, Databases, Account } from "node-appwrite";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers";

if (!projectId || !apiKey) {
  console.error("❌ Missing credentials");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);
const account = new Account(client);

async function testAppwrite() {
  console.log("🔍 Testing Appwrite connection...\n");
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project: ${projectId}`);
  console.log(`Database: ${databaseId}\n`);

  // 1. Test account access
  try {
    const acc = await account.get();
    console.log("✅ Account API works:", acc.$id);
  } catch (e) {
    console.log("⚠️  Account API (expected to fail with API key):", e.message);
  }

  // 2. Test database access
  try {
    const db = await databases.get(databaseId);
    console.log("✅ Database exists:", db.name);
  } catch (e) {
    console.error("❌ Database error:", e.message);
    return;
  }

  // 3. List collections
  try {
    const cols = await databases.listCollections(databaseId);
    console.log(`\n📦 Collections (${cols.total}):`);
    for (const c of cols.collections) {
      console.log(`   - ${c.$id} (${c.name})`);
    }
  } catch (e) {
    console.error("❌ List collections error:", e.message);
  }

  // 4. Test a few key collections
  const testCollections = ["profiles", "posts", "call-signals", "rooms"];
  for (const collId of testCollections) {
    try {
      const attrs = await databases.listAttributes(databaseId, collId);
      console.log(`\n📋 ${collId} attributes (${attrs.total}):`);
      for (const a of attrs.attributes) {
        console.log(`   - ${a.key}: ${a.type} ${a.required ? "(required)" : ""} ${a.array ? "[array]" : ""} ${a.enum ? `enum:[${a.enum.join(",")}]` : ""} - status: ${a.status}`);
      }
    } catch (e) {
      console.log(`\n❌ ${collId}:`, e.message);
    }
  }

  // 5. Test health check endpoint
  console.log("\n🏥 Running platform health checks...");
  try {
    const response = await fetch(`${endpoint}/health/version`, {
      headers: {
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey,
      },
    });
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Appwrite reachable, version:", data.version);
    } else {
      console.log("❌ Health check failed:", response.status);
    }
  } catch (e) {
    console.error("❌ Health check error:", e.message);
  }

  console.log("\n✅ Appwrite connection test complete!");
}

testAppwrite().catch(console.error);