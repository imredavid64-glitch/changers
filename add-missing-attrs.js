#!/usr/bin/env node
/**
 * Add missing attributes to match TypeScript types
 */

import { Client, Databases } from "node-appwrite";
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

const missingAttrs = {
  profiles: [
    { key: "saved_project_ids", type: "string", size: 36, required: false, array: true },
    { key: "theme", type: "string", size: 10, required: false },
    { key: "email_notifications", type: "boolean", required: false, default: false },
    { key: "impact_score", type: "integer", required: false },
    { key: "strand_counts", type: "string", size: 1000, required: false }, // JSON as string
  ],
  posts: [
    { key: "tags", type: "string", size: 50, required: false, array: true },
    { key: "search_index", type: "string", size: 10000, required: false },
    { key: "poll_options", type: "string", size: 255, required: false, array: true },
    { key: "poll_votes", type: "string", size: 5000, required: false }, // JSON as string
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  comments: [
    { key: "author_avatar_media_storage_key", type: "string", size: 500, required: false },
    { key: "author_avatar_media_url", type: "string", size: 1000, required: false },
    { key: "author_avatar_url", type: "string", size: 1000, required: false },
    { key: "created_at_ms", type: "integer", required: false },
  ],
  notifications: [
    { key: "post_id", type: "string", size: 255, required: false },
    { key: "room_id", type: "string", size: 255, required: false },
    { key: "project_id", type: "string", size: 255, required: false },
    { key: "event_id", type: "string", size: 255, required: false },
    { key: "created_at_ms", type: "integer", required: false },
  ],
  follows: [
    { key: "created_at_ms", type: "integer", required: false },
  ],
  "saved-posts": [
    { key: "created_at_ms", type: "integer", required: false },
  ],
  rooms: [
    { key: "strand", type: "string", size: 1, required: false }, // already added
    { key: "search_index", type: "string", size: 10000, required: false },
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  "room-messages": [
    { key: "created_at_ms", type: "integer", required: false },
  ],
  threads: [
    { key: "created_at_ms", type: "integer", required: false },
  ],
  "thread-messages": [
    { key: "created_at_ms", type: "integer", required: false },
  ],
  blocks: [
    { key: "created_at_ms", type: "integer", required: false },
  ],
  projects: [
    { key: "tags", type: "string", size: 50, required: false, array: true },
    { key: "search_index", type: "string", size: 10000, required: false },
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  "project-members": [
    { key: "role", type: "string", size: 50, required: false },
    { key: "joined_at_ms", type: "integer", required: false },
  ],
  tasks: [
    { key: "description", type: "string", size: 5000, required: false },
    { key: "priority", type: "string", size: 10, required: false },
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  badges: [
    { key: "earned_at_ms", type: "integer", required: false },
    { key: "metadata", type: "string", size: 10000, required: false }, // already added
  ],
  events: [
    { key: "location", type: "string", size: 500, required: false },
    { key: "is_online", type: "boolean", required: false, default: false },
    { key: "online_url", type: "string", size: 1000, required: false },
    { key: "rsvp_count", type: "integer", required: false, default: 0 },
    { key: "tags", type: "string", size: 50, required: false, array: true },
    { key: "search_index", type: "string", size: 10000, required: false },
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  "event-rsvps": [
    { key: "created_at_ms", type: "integer", required: false },
  ],
  documents: [
    { key: "body", type: "string", size: 50000, required: false },
    { key: "word_count", type: "integer", required: false, default: 0 },
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  slideshows: [
    { key: "template_id", type: "string", size: 255, required: false },
    { key: "slides", type: "string", size: 50000, required: false }, // already added
    { key: "slide_count", type: "integer", required: false, default: 0 },
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  tables: [
    { key: "rows", type: "integer", required: false, default: 0 },
    { key: "cols", type: "integer", required: false, default: 0 },
    { key: "data", type: "string", size: 50000, required: false }, // already added
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  "code-snippets": [
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  designs: [
    { key: "canvas_width", type: "integer", required: false, default: 1920 },
    { key: "canvas_height", type: "integer", required: false, default: 1080 },
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  films: [
    { key: "scene_count", type: "integer", required: false, default: 0 },
    { key: "created_at_ms", type: "integer", required: false },
    { key: "updated_at_ms", type: "integer", required: false },
  ],
  "call-signals": [
    { key: "kind", type: "string", size: 20, required: false }, // already added
  ],
  "privacy-settings": [
    { key: "settings", type: "string", size: 10000, required: false }, // already added
    { key: "updated_at_ms", type: "integer", required: false },
  ],
};

async function createAttr(db, coll, attr) {
  try {
    if (attr.type === "string") {
      await databases.createStringAttribute(db, coll, attr.key, attr.size, attr.required, attr.default || undefined, attr.array || false);
    } else if (attr.type === "integer") {
      await databases.createIntegerAttribute(db, coll, attr.key, attr.required, attr.default || undefined, undefined, undefined, attr.array || false);
    } else if (attr.type === "boolean") {
      await databases.createBooleanAttribute(db, coll, attr.key, attr.required, attr.default || undefined, attr.array || false);
    }
    console.log(`   ✅ ${coll}.${attr.key}`);
    return true;
  } catch (e) {
    if (e.code === 409) {
      console.log(`   ⏭️  ${coll}.${attr.key} already exists`);
      return true;
    }
    if (e.message.includes("maximum number or size")) {
      console.log(`   ⚠️  ${coll}.${attr.key} - attribute limit reached`);
      return false;
    }
    console.error(`   ❌ ${coll}.${attr.key}:`, e.message);
    return false;
  }
}

async function main() {
  console.log("📝 Adding missing attributes...\n");

  for (const [coll, attrs] of Object.entries(missingAttrs)) {
    console.log(`\n📦 ${coll}:`);
    for (const attr of attrs) {
      await createAttr(databaseId, coll, attr);
    }
  }

  console.log("\n✅ Done! Restart dev server to pick up new attributes.");
}

main().catch(console.error);