#!/usr/bin/env node
/**
 * Fix missing enum and JSON attributes in existing collections.
 * Run after create-collections.js
 */

import { Client, Databases } from "node-appwrite";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers";

if (!projectId || !apiKey) {
  console.error("❌ Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

// Collections that need enum attributes fixed (string without enum validation)
const enumFixes = [
  { collection: "notifications", attr: "type", size: 20, required: true, enum: ["like", "comment", "follow", "system", "bot", "poll_vote", "project_invite", "event_reminder"] },
  { collection: "rooms", attr: "strand", size: 1, required: true, enum: ["N", "E", "S", "W"] },
  { collection: "projects", attr: "strand", size: 1, required: true, enum: ["N", "E", "S", "W"] },
  { collection: "projects", attr: "status", size: 20, required: true, enum: ["active", "completed", "paused"] },
  { collection: "tasks", attr: "status", size: 20, required: true, enum: ["todo", "in-progress", "done"] },
  { collection: "tasks", attr: "priority", size: 10, required: false, enum: ["low", "medium", "high"] },
  { collection: "badges", attr: "badge_category", size: 20, required: true, enum: ["milestone", "social", "creation", "impact", "streak", "special"] },
  { collection: "events", attr: "strand", size: 1, required: true, enum: ["N", "E", "S", "W"] },
  { collection: "event-rsvps", attr: "status", size: 20, required: true, enum: ["going", "interested", "not_going"] },
  { collection: "call-signals", attr: "kind", size: 20, required: true, enum: ["presence", "rtc", "chat", "whiteboard", "timer", "reaction", "breakout"] },
];

// Collections that need JSON attributes (created as string)
const jsonFixes = [
  { collection: "badges", attr: "metadata", size: 10000, required: false },
  { collection: "slideshows", attr: "slides", size: 50000, required: false },
  { collection: "tables", attr: "data", size: 50000, required: false },
  { collection: "designs", attr: "elements", size: 50000, required: false },
  { collection: "films", attr: "scenes", size: 50000, required: false },
  { collection: "privacy-settings", attr: "settings", size: 10000, required: false },
];

// Collections that need search_index added (hit attribute limit)
const searchIndexFixes = [
  { collection: "rooms", attr: "search_index", size: 10000, required: true },
  { collection: "events", attr: "search_index", size: 10000, required: true },
];

async function createStringAttribute(db, coll, attr, size, required, defaultVal) {
  try {
    await databases.createStringAttribute(db, coll, attr, size, required, defaultVal, false);
    console.log(`   ✅ String attr: ${attr}`);
    return true;
  } catch (e) {
    if (e.code === 409) {
      console.log(`   ⏭️  String attr "${attr}" already exists`);
      return true;
    }
    console.error(`   ❌ String attr "${attr}":`, e.message);
    return false;
  }
}

async function waitForAttribute(db, coll, attr, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const attrs = await databases.listAttributes(db, coll);
      const found = attrs.attributes.find(a => a.key === attr && a.status === "available");
      if (found) return true;
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function createIndex(db, coll, key, type, attrs) {
  try {
    await databases.createIndex(db, coll, key, type, attrs);
    console.log(`   ✅ Index: ${key}`);
    return true;
  } catch (e) {
    if (e.code === 409) {
      console.log(`   ⏭️  Index "${key}" already exists`);
      return true;
    }
    console.error(`   ❌ Index "${key}":`, e.message);
    return false;
  }
}

async function main() {
  console.log("🔧 Fixing missing attributes...\n");

  // Fix enum attributes (create as string without enum validation for now)
  console.log("📝 Adding missing enum attributes (as strings)...");
  for (const fix of enumFixes) {
    console.log(`\n📦 ${fix.collection}.${fix.attr}`);
    await createStringAttribute(databaseId, fix.collection, fix.attr, fix.size, fix.required, undefined);
  }

  // Wait for attributes to be available
  console.log("\n⏳ Waiting for attributes to become available...");
  await new Promise(r => setTimeout(r, 5000));

  // Fix JSON attributes (as strings)
  console.log("\n📝 Adding missing JSON attributes (as strings)...");
  for (const fix of jsonFixes) {
    console.log(`\n📦 ${fix.collection}.${fix.attr}`);
    await createStringAttribute(databaseId, fix.collection, fix.attr, fix.size, fix.required, undefined);
  }

  // Wait again
  await new Promise(r => setTimeout(r, 3000));

  // Add search_index for rooms and events (if they have space)
  console.log("\n📝 Adding search_index attributes...");
  for (const fix of searchIndexFixes) {
    console.log(`\n📦 ${fix.collection}.${fix.attr}`);
    await createStringAttribute(databaseId, fix.collection, fix.attr, fix.size, fix.required, undefined);
  }

  // Wait for attributes
  await new Promise(r => setTimeout(r, 3000));

  // Now create missing indexes
  console.log("\n🔍 Creating missing indexes...");
  const indexes = [
    { coll: "notifications", key: "type", type: "key", attrs: ["type"] },
    { coll: "rooms", key: "strand", type: "key", attrs: ["strand"] },
    { coll: "rooms", key: "search_index", type: "fulltext", attrs: ["search_index"] },
    { coll: "projects", key: "strand", type: "key", attrs: ["strand"] },
    { coll: "projects", key: "status", type: "key", attrs: ["status"] },
    { coll: "tasks", key: "status", type: "key", attrs: ["status"] },
    { coll: "tasks", key: "priority", type: "key", attrs: ["priority"] },
    { coll: "badges", key: "badge_category", type: "key", attrs: ["badge_category"] },
    { coll: "events", key: "strand", type: "key", attrs: ["strand"] },
    { coll: "events", key: "search_index", type: "fulltext", attrs: ["search_index"] },
    { coll: "event-rsvps", key: "status", type: "key", attrs: ["status"] },
    { coll: "call-signals", key: "kind", type: "key", attrs: ["kind"] },
  ];

  for (const idx of indexes) {
    console.log(`\n📦 ${idx.coll} → index ${idx.key}`);
    await createIndex(databaseId, idx.coll, idx.key, idx.type, idx.attrs);
  }

  console.log("\n✅ Fix script complete!");
  console.log("\n📋 Note: Enum validation is not enforced at DB level.");
  console.log("   Application code should validate enum values before writing.");
  console.log("   JSON attributes stored as strings - parse with JSON.parse() when reading.");
}

main().catch(console.error);