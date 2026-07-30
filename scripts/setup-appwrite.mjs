#!/usr/bin/env node
import { Client, Databases, Storage, ID } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "http://localhost:8080/v1";

const required = [
  ["NEXT_PUBLIC_APPWRITE_PROJECT_ID", "Project ID (from Appwrite Console > Settings)"],
  ["APPWRITE_API_KEY", "API Key (from Appwrite Console > API Keys, with full access)"],
];

const missing = required.filter(([k]) => !process.env[k]);
if (missing.length > 0) {
  console.error("Set these env vars:");
  for (const [key, desc] of missing) {
    console.error(`  ${key} — ${desc}`);
  }
  console.error("\nOr run with:\n  NEXT_PUBLIC_APPWRITE_PROJECT_ID=xxx APPWRITE_API_KEY=xxx node scripts/setup-appwrite.mjs");
  process.exit(1);
}

const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!projectId) { console.error("Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID"); process.exit(1); }
if (!apiKey) { console.error("Missing APPWRITE_API_KEY"); process.exit(1); }

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "changers";
const BUCKET_ID = process.env.APPWRITE_MEDIA_BUCKET_ID || "changers-media";

const COLLECTIONS = {
  profiles: {
    documentId: (userId) => userId,
    attributes: [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "full_name", type: "string", size: 256, required: true },
      { key: "role", type: "string", size: 128, required: true },
      { key: "headline", type: "string", size: 512, required: false },
      { key: "bio", type: "string", size: 4096, required: false },
      { key: "location", type: "string", size: 256, required: false },
      { key: "avatar_file_id", type: "string", size: 64, required: false },
      { key: "avatar_media_id", type: "string", size: 64, required: false },
      { key: "avatar_media_storage_key", type: "string", size: 256, required: false },
      { key: "avatar_media_url", type: "string", size: 1024, required: false },
      { key: "avatar_url", type: "string", size: 1024, required: false },
      { key: "is_mentor", type: "boolean", required: true },
      { key: "mentor_focus", type: "string", size: 256, required: false },
      { key: "is_admin", type: "boolean", required: true },
      { key: "privacy", type: "string", size: 16, required: true },
      { key: "dm_permission", type: "string", size: 16, required: false },
      { key: "push_subscription", type: "string", size: 4096, required: false },
      { key: "search_index", type: "string", size: 4096, required: true },
      { key: "interests", type: "string[]", required: true },
      { key: "created_at_ms", type: "integer", required: true },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "created_idx", type: "key", attributes: ["created_at_ms"], orders: ["desc"] },
      { key: "search_idx", type: "fulltext", attributes: ["search_index"] },
    ],
  },
  posts: {
    attributes: [
      { key: "title", type: "string", size: 512, required: true },
      { key: "body", type: "string", size: 65536, required: false },
      { key: "strand", type: "string", size: 4, required: true },
      { key: "author_id", type: "string", size: 64, required: true },
      { key: "author_name", type: "string", size: 256, required: true },
      { key: "author_role", type: "string", size: 128, required: true },
      { key: "author_avatar_file_id", type: "string", size: 64, required: false },
      { key: "author_avatar_media_id", type: "string", size: 64, required: false },
      { key: "author_avatar_media_storage_key", type: "string", size: 256, required: false },
      { key: "author_avatar_media_url", type: "string", size: 1024, required: false },
      { key: "author_avatar_url", type: "string", size: 1024, required: false },
      { key: "image_file_id", type: "string", size: 64, required: false },
      { key: "image_media_id", type: "string", size: 64, required: false },
      { key: "image_media_storage_key", type: "string", size: 256, required: false },
      { key: "image_media_url", type: "string", size: 1024, required: false },
      { key: "image_url", type: "string", size: 1024, required: false },
      { key: "video_url", type: "string", size: 1024, required: false },
      { key: "video_file_id", type: "string", size: 64, required: false },
      { key: "video_media_id", type: "string", size: 64, required: false },
      { key: "video_media_storage_key", type: "string", size: 256, required: false },
      { key: "is_poll", type: "boolean", required: true },
      { key: "poll_question", type: "string", size: 1024, required: false },
      { key: "likes", type: "string[]", required: true },
      { key: "likes_count", type: "integer", required: true },
      { key: "comments_count", type: "integer", required: true },
      { key: "tags", type: "string[]", required: false },
      { key: "search_index", type: "string", size: 4096, required: true },
      { key: "created_at_ms", type: "integer", required: true },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "author_idx", type: "key", attributes: ["author_id"], orders: ["asc"] },
      { key: "strand_idx", type: "key", attributes: ["strand"], orders: ["asc"] },
      { key: "created_idx", type: "key", attributes: ["created_at_ms"], orders: ["desc"] },
      { key: "search_idx", type: "fulltext", attributes: ["search_index"] },
    ],
  },
  comments: {
    attributes: [
      { key: "post_id", type: "string", size: 64, required: true },
      { key: "author_id", type: "string", size: 64, required: true },
      { key: "author_name", type: "string", size: 256, required: true },
      { key: "author_avatar_file_id", type: "string", size: 64, required: false },
      { key: "author_avatar_media_id", type: "string", size: 64, required: false },
      { key: "author_avatar_media_storage_key", type: "string", size: 256, required: false },
      { key: "author_avatar_media_url", type: "string", size: 1024, required: false },
      { key: "text", type: "string", size: 4096, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "post_idx", type: "key", attributes: ["post_id"], orders: ["asc"] },
      { key: "created_idx", type: "key", attributes: ["created_at_ms"], orders: ["desc"] },
    ],
  },
  notifications: {
    attributes: [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "type", type: "string", size: 32, required: true },
      { key: "actor_name", type: "string", size: 256, required: true },
      { key: "actor_id", type: "string", size: 64, required: true },
      { key: "post_id", type: "string", size: 64, required: false },
      { key: "room_id", type: "string", size: 64, required: false },
      { key: "project_id", type: "string", size: 64, required: false },
      { key: "event_id", type: "string", size: 64, required: false },
      { key: "read", type: "boolean", required: true },
      { key: "message", type: "string", size: 1024, required: false },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "user_idx", type: "key", attributes: ["user_id"], orders: ["asc"] },
      { key: "created_idx", type: "key", attributes: ["created_at_ms"], orders: ["desc"] },
    ],
  },
  follows: {
    documentId: (followerId, followeeId) => `${followerId}_${followeeId}`,
    attributes: [
      { key: "follower_id", type: "string", size: 64, required: true },
      { key: "followee_id", type: "string", size: 64, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "follower_idx", type: "key", attributes: ["follower_id"], orders: ["asc"] },
      { key: "followee_idx", type: "key", attributes: ["followee_id"], orders: ["asc"] },
    ],
  },
  "saved-posts": {
    attributes: [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "post_id", type: "string", size: 64, required: true },
      { key: "author_id", type: "string", size: 64, required: true },
      { key: "strand", type: "string", size: 4, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "user_idx", type: "key", attributes: ["user_id"], orders: ["asc"] },
      { key: "post_idx", type: "key", attributes: ["post_id"], orders: ["asc"] },
    ],
  },
  rooms: {
    attributes: [
      { key: "name", type: "string", size: 256, required: true },
      { key: "description", type: "string", size: 4096, required: true },
      { key: "strand", type: "string", size: 4, required: true },
      { key: "tags", type: "string[]", required: false },
      { key: "search_index", type: "string", size: 4096, required: true },
      { key: "owner_id", type: "string", size: 64, required: true },
      { key: "owner_name", type: "string", size: 256, required: true },
      { key: "members", type: "string[]", required: true },
      { key: "member_count", type: "integer", required: true },
      { key: "last_message", type: "string", size: 1024, required: false },
      { key: "created_at_ms", type: "integer", required: true },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "strand_idx", type: "key", attributes: ["strand"], orders: ["asc"] },
      { key: "updated_idx", type: "key", attributes: ["updated_at_ms"], orders: ["desc"] },
      { key: "search_idx", type: "fulltext", attributes: ["search_index"] },
    ],
  },
  "room-messages": {
    attributes: [
      { key: "room_id", type: "string", size: 64, required: true },
      { key: "author_id", type: "string", size: 64, required: true },
      { key: "author_name", type: "string", size: 256, required: true },
      { key: "text", type: "string", size: 4096, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "room_idx", type: "key", attributes: ["room_id"], orders: ["asc"] },
      { key: "created_idx", type: "key", attributes: ["created_at_ms"], orders: ["desc"] },
    ],
  },
  threads: {
    documentId: (p1, p2) => [p1, p2].sort().join("_"),
    attributes: [
      { key: "participants", type: "string[]", required: true },
      { key: "last_message", type: "string", size: 1024, required: false },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "updated_idx", type: "key", attributes: ["updated_at_ms"], orders: ["desc"] },
    ],
  },
  "thread-messages": {
    attributes: [
      { key: "thread_id", type: "string", size: 64, required: true },
      { key: "sender_id", type: "string", size: 64, required: true },
      { key: "sender_name", type: "string", size: 256, required: true },
      { key: "text", type: "string", size: 4096, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "thread_idx", type: "key", attributes: ["thread_id"], orders: ["asc"] },
      { key: "created_idx", type: "key", attributes: ["created_at_ms"], orders: ["desc"] },
    ],
  },
  blocks: {
    documentId: (blockerId, blockedId) => `${blockerId}_${blockedId}`,
    attributes: [
      { key: "blocker_id", type: "string", size: 64, required: true },
      { key: "blocked_id", type: "string", size: 64, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "blocker_idx", type: "key", attributes: ["blocker_id"], orders: ["asc"] },
      { key: "blocked_idx", type: "key", attributes: ["blocked_id"], orders: ["asc"] },
    ],
  },
  "privacy-settings": {
    documentId: (userId) => userId,
    attributes: [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "profile_visibility", type: "string", size: 16, required: true },
      { key: "posts_visibility", type: "string", size: 16, required: true },
      { key: "dm_permission", type: "string", size: 16, required: true },
      { key: "show_saved_posts", type: "boolean", required: true },
      { key: "created_at_ms", type: "integer", required: true },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "user_idx", type: "key", attributes: ["user_id"], orders: ["asc"] },
    ],
  },
  projects: {
    attributes: [
      { key: "name", type: "string", size: 256, required: true },
      { key: "description", type: "string", size: 4096, required: true },
      { key: "strand", type: "string", size: 4, required: true },
      { key: "tags", type: "string[]", required: false },
      { key: "search_index", type: "string", size: 4096, required: true },
      { key: "owner_id", type: "string", size: 64, required: true },
      { key: "owner_name", type: "string", size: 256, required: true },
      { key: "members", type: "string[]", required: true },
      { key: "member_count", type: "integer", required: true },
      { key: "status", type: "string", size: 16, required: true },
      { key: "created_at_ms", type: "integer", required: true },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "owner_idx", type: "key", attributes: ["owner_id"], orders: ["asc"] },
      { key: "strand_idx", type: "key", attributes: ["strand"], orders: ["asc"] },
      { key: "status_idx", type: "key", attributes: ["status"], orders: ["asc"] },
      { key: "search_idx", type: "fulltext", attributes: ["search_index"] },
    ],
  },
  "project-members": {
    attributes: [
      { key: "project_id", type: "string", size: 64, required: true },
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "role", type: "string", size: 16, required: true },
      { key: "joined_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "project_idx", type: "key", attributes: ["project_id"], orders: ["asc"] },
      { key: "user_idx", type: "key", attributes: ["user_id"], orders: ["asc"] },
    ],
  },
  events: {
    attributes: [
      { key: "title", type: "string", size: 256, required: true },
      { key: "description", type: "string", size: 4096, required: false },
      { key: "strand", type: "string", size: 4, required: true },
      { key: "date", type: "string", size: 32, required: true },
      { key: "time", type: "string", size: 16, required: false },
      { key: "location", type: "string", size: 256, required: false },
      { key: "is_online", type: "boolean", required: true },
      { key: "online_url", type: "string", size: 1024, required: false },
      { key: "tags", type: "string[]", required: false },
      { key: "search_index", type: "string", size: 4096, required: true },
      { key: "host_id", type: "string", size: 64, required: true },
      { key: "host_name", type: "string", size: 256, required: true },
      { key: "rsvp_count", type: "integer", required: true },
      { key: "created_at_ms", type: "integer", required: true },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "host_idx", type: "key", attributes: ["host_id"], orders: ["asc"] },
      { key: "date_idx", type: "key", attributes: ["date"], orders: ["asc"] },
      { key: "strand_idx", type: "key", attributes: ["strand"], orders: ["asc"] },
      { key: "search_idx", type: "fulltext", attributes: ["search_index"] },
    ],
  },
  documents: {
    attributes: [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "title", type: "string", size: 512, required: true },
      { key: "body", type: "string", size: 65536, required: false },
      { key: "word_count", type: "integer", required: true },
      { key: "created_at_ms", type: "integer", required: true },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "user_idx", type: "key", attributes: ["user_id"], orders: ["asc"] },
      { key: "updated_idx", type: "key", attributes: ["updated_at_ms"], orders: ["desc"] },
    ],
  },
  slideshows: {
    attributes: [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "title", type: "string", size: 512, required: true },
      { key: "template_id", type: "string", size: 64, required: false },
      { key: "slides_json", type: "string", size: 65536, required: true },
      { key: "slide_count", type: "integer", required: true },
      { key: "created_at_ms", type: "integer", required: true },
      { key: "updated_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "user_idx", type: "key", attributes: ["user_id"], orders: ["asc"] },
      { key: "updated_idx", type: "key", attributes: ["updated_at_ms"], orders: ["desc"] },
    ],
  },
  "event-rsvps": {
    documentId: (eventId, userId) => `${eventId}_${userId}`,
    attributes: [
      { key: "event_id", type: "string", size: 64, required: true },
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "user_name", type: "string", size: 256, required: true },
      { key: "status", type: "string", size: 16, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "event_idx", type: "key", attributes: ["event_id"], orders: ["asc"] },
      { key: "user_idx", type: "key", attributes: ["user_id"], orders: ["asc"] },
    ],
  },
};

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createDatabase() {
  console.log(`\nCreating database "${DATABASE_ID}"...`);
  try {
    await databases.create(DATABASE_ID, DATABASE_ID);
    console.log("  Database created");
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log("  Database already exists");
    } else {
      throw e;
    }
  }
}

async function createBucket() {
  console.log(`\nCreating storage bucket "${BUCKET_ID}"...`);
  try {
    await storage.createBucket(BUCKET_ID, BUCKET_ID, [
      'read("any")',
      'create("users")',
      'update("users")',
      'delete("users")',
    ], false, undefined, undefined, []);
    console.log("  Bucket created (100MB max per file)");
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log("  Bucket already exists");
    } else {
      throw e;
    }
  }
}

async function createCollection(collectionId, config) {
  console.log(`\nCreating collection "${collectionId}"...`);
  let collection;
  try {
    collection = await databases.createCollection(DATABASE_ID, collectionId, collectionId, [
      'read("any")',
      'create("users")',
      'update("users")',
      'delete("users")',
    ]);
    console.log(`  Collection created`);
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log(`  Collection already exists, using existing`);
      collection = { $id: collectionId };
    } else {
      throw e;
    }
  }

  for (const attr of config.attributes) {
    const existing = await databases.listAttributes(DATABASE_ID, collectionId);
    if (existing.attributes?.some((a) => a.key === attr.key)) {
      console.log(`  Attribute "${attr.key}" exists, skipping`);
      continue;
    }
    try {
      if (attr.type === "integer") {
        await databases.createIntegerAttribute(DATABASE_ID, collectionId, attr.key, attr.required);
      } else if (attr.type === "boolean") {
        await databases.createBooleanAttribute(DATABASE_ID, collectionId, attr.key, attr.required);
      } else if (attr.type === "string") {
        await databases.createStringAttribute(DATABASE_ID, collectionId, attr.key, attr.size || 256, attr.required);
      } else if (attr.type === "string[]") {
        await databases.createStringAttribute(DATABASE_ID, collectionId, attr.key, 65536, attr.required, undefined, true);
      }
      console.log(`  Attribute "${attr.key}" (${attr.type}) created`);
      await sleep(500);
    } catch (e) {
      console.error(`  FAILED attribute "${attr.key}": ${e.message}`);
    }
  }

  await sleep(1000);

  for (const idx of config.indexes) {
    try {
      await databases.createIndex(DATABASE_ID, collectionId, idx.key, idx.type, idx.attributes, idx.orders, idx.lengths);
      console.log(`  Index "${idx.key}" created`);
      await sleep(500);
    } catch (e) {
      if (e.message?.includes("already exists")) {
        console.log(`  Index "${idx.key}" exists, skipping`);
      } else {
        console.error(`  FAILED index "${idx.key}": ${e.message}`);
      }
    }
  }
}

async function main() {
  console.log("=== Appwrite Setup Script ===\n");
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Project: ${projectId}`);

  await createDatabase();
  await createBucket();

  for (const [collectionId, config] of Object.entries(COLLECTIONS)) {
    await createCollection(collectionId, config);
  }

  console.log("\n=== Setup complete! ===");
  console.log(`\nNext steps:`);
  console.log(`1. Set NEXT_PUBLIC_APPWRITE_PROJECT_ID=${projectId} in web/.env.local`);
  console.log(`2. Enable Email/Password auth in Appwrite Console > Auth > Settings`);
  console.log(`3. Run your app and sign up`);
  console.log(`4. After signing up, set is_admin=true on your profile in Appwrite Console > Database > bridge > profiles`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
