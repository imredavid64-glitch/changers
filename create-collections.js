#!/usr/bin/env node
/**
 * Auto-create all Appwrite collections for Changers platform.
 * 
 * Prerequisites:
 *   - Appwrite project created
 *   - Database "changers" created
 *   - API key with scopes: databases.read, databases.write, collections.read, collections.write
 * 
 * Usage:
 *   1. Copy .env.local to this directory or set env vars
 *   2. node create-collections.js
 */

import { Client, Databases, Permission, Role } from "node-appwrite";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers";

if (!projectId || !apiKey) {
  console.error("❌ Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY in .env.local");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

const permissions = [
  Permission.read(Role.users()),
  Permission.write(Role.users()),
];

const collections = [
  // 1. profiles (critical - admin check reads is_admin)
  {
    id: "profiles",
    name: "Profiles",
    attributes: [
      { key: "full_name", type: "string", size: 255, required: true },
      { key: "role", type: "string", size: 255, required: true },
      { key: "headline", type: "string", size: 500, required: false },
      { key: "bio", type: "string", size: 5000, required: false },
      { key: "location", type: "string", size: 255, required: false },
      { key: "avatar_file_id", type: "string", size: 255, required: false },
      { key: "avatar_media_id", type: "string", size: 255, required: false },
      { key: "avatar_media_storage_key", type: "string", size: 500, required: false },
      { key: "avatar_media_url", type: "string", size: 1000, required: false },
      { key: "avatar_url", type: "string", size: 1000, required: false },
      { key: "interests", type: "string", size: 10, required: false, array: true },
      { key: "saved_project_ids", type: "string", size: 36, required: false, array: true },
      { key: "is_mentor", type: "boolean", required: false, default: false },
      { key: "mentor_focus", type: "string", size: 500, required: false },
      { key: "is_admin", type: "boolean", required: true, default: false },
      { key: "privacy", type: "string", size: 10, required: false, enum: ["public", "followers", "private"] },
      { key: "theme", type: "string", size: 10, required: false, enum: ["moss", "ocean", "sunset", "rose"] },
      { key: "email_notifications", type: "boolean", required: false, default: false },
      { key: "impact_score", type: "integer", required: false },
      { key: "strand_counts", type: "json", required: false },
      { key: "push_subscription", type: "string", size: 5000, required: false },
      { key: "search_index", type: "string", size: 10000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "is_admin", type: "key", attributes: ["is_admin"] },
      { key: "search_index", type: "fulltext", attributes: ["search_index"] },
    ],
  },

  // 2. posts
  {
    id: "posts",
    name: "Posts",
    attributes: [
      { key: "title", type: "string", size: 255, required: false },
      { key: "body", type: "string", size: 10000, required: true },
      { key: "strand", type: "string", size: 1, required: true, enum: ["N", "E", "S", "W"] },
      { key: "author_id", type: "string", size: 255, required: true },
      { key: "author_name", type: "string", size: 255, required: true },
      { key: "author_role", type: "string", size: 255, required: true },
      { key: "author_avatar_file_id", type: "string", size: 255, required: false },
      { key: "author_avatar_media_id", type: "string", size: 255, required: false },
      { key: "author_avatar_media_storage_key", type: "string", size: 500, required: false },
      { key: "author_avatar_media_url", type: "string", size: 1000, required: false },
      { key: "author_avatar_url", type: "string", size: 1000, required: false },
      { key: "image_file_id", type: "string", size: 255, required: false },
      { key: "image_media_id", type: "string", size: 255, required: false },
      { key: "image_media_storage_key", type: "string", size: 500, required: false },
      { key: "image_media_url", type: "string", size: 1000, required: false },
      { key: "image_url", type: "string", size: 1000, required: false },
      { key: "video_url", type: "string", size: 1000, required: false },
      { key: "is_poll", type: "boolean", required: false, default: false },
      { key: "poll_question", type: "string", size: 500, required: false },
      { key: "poll_options", type: "string", size: 255, required: false, array: true },
      { key: "poll_votes", type: "json", required: false },
      { key: "video_file_id", type: "string", size: 255, required: false },
      { key: "video_media_id", type: "string", size: 255, required: false },
      { key: "video_media_storage_key", type: "string", size: 500, required: false },
      { key: "likes", type: "string", size: 36, required: false, array: true },
      { key: "likes_count", type: "integer", required: false, default: 0 },
      { key: "comments_count", type: "integer", required: false, default: 0 },
      { key: "tags", type: "string", size: 50, required: false, array: true },
      { key: "search_index", type: "string", size: 10000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "author_id", type: "key", attributes: ["author_id"] },
      { key: "strand", type: "key", attributes: ["strand"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 3. comments
  {
    id: "comments",
    name: "Comments",
    attributes: [
      { key: "post_id", type: "string", size: 255, required: true },
      { key: "author_id", type: "string", size: 255, required: true },
      { key: "author_name", type: "string", size: 255, required: true },
      { key: "author_avatar_file_id", type: "string", size: 255, required: false },
      { key: "author_avatar_media_id", type: "string", size: 255, required: false },
      { key: "author_avatar_media_storage_key", type: "string", size: 500, required: false },
      { key: "author_avatar_media_url", type: "string", size: 1000, required: false },
      { key: "author_avatar_url", type: "string", size: 1000, required: false },
      { key: "text", type: "string", size: 5000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "post_id", type: "key", attributes: ["post_id"] },
      { key: "author_id", type: "key", attributes: ["author_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 4. notifications
  {
    id: "notifications",
    name: "Notifications",
    attributes: [
      { key: "type", type: "string", size: 20, required: true, enum: ["like", "comment", "follow", "system", "bot", "poll_vote", "project_invite", "event_reminder"] },
      { key: "actor_name", type: "string", size: 255, required: true },
      { key: "actor_id", type: "string", size: 255, required: true },
      { key: "post_id", type: "string", size: 255, required: false },
      { key: "room_id", type: "string", size: 255, required: false },
      { key: "project_id", type: "string", size: 255, required: false },
      { key: "event_id", type: "string", size: 255, required: false },
      { key: "read", type: "boolean", required: true, default: false },
      { key: "message", type: "string", size: 1000, required: false },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "read", type: "key", attributes: ["read"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 5. follows
  {
    id: "follows",
    name: "Follows",
    attributes: [
      { key: "follower_id", type: "string", size: 255, required: true },
      { key: "followee_id", type: "string", size: 255, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "follower_id", type: "key", attributes: ["follower_id"] },
      { key: "followee_id", type: "key", attributes: ["followee_id"] },
    ],
  },

  // 6. saved-posts
  {
    id: "saved-posts",
    name: "Saved Posts",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "post_id", type: "string", size: 255, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "post_id", type: "key", attributes: ["post_id"] },
    ],
  },

  // 7. rooms
  {
    id: "rooms",
    name: "Rooms",
    attributes: [
      { key: "name", type: "string", size: 255, required: true },
      { key: "description", type: "string", size: 5000, required: false },
      { key: "strand", type: "string", size: 1, required: true, enum: ["N", "E", "S", "W"] },
      { key: "owner_id", type: "string", size: 255, required: true },
      { key: "owner_name", type: "string", size: 255, required: true },
      { key: "members", type: "string", size: 36, required: false, array: true },
      { key: "member_count", type: "integer", required: false, default: 0 },
      { key: "tags", type: "string", size: 50, required: false, array: true },
      { key: "last_message", type: "string", size: 500, required: false },
      { key: "search_index", type: "string", size: 10000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "owner_id", type: "key", attributes: ["owner_id"] },
      { key: "strand", type: "key", attributes: ["strand"] },
      { key: "member_count", type: "key", attributes: ["member_count"] },
    ],
  },

  // 8. room-messages
  {
    id: "room-messages",
    name: "Room Messages",
    attributes: [
      { key: "room_id", type: "string", size: 255, required: true },
      { key: "sender_id", type: "string", size: 255, required: true },
      { key: "sender_name", type: "string", size: 255, required: true },
      { key: "text", type: "string", size: 5000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "room_id", type: "key", attributes: ["room_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 9. threads
  {
    id: "threads",
    name: "Threads",
    attributes: [
      { key: "participants", type: "string", size: 36, required: true, array: true },
      { key: "last_message", type: "string", size: 500, required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "participants", type: "key", attributes: ["participants"] },
      { key: "updated_at_ms", type: "key", attributes: ["updated_at_ms"] },
    ],
  },

  // 10. thread-messages
  {
    id: "thread-messages",
    name: "Thread Messages",
    attributes: [
      { key: "thread_id", type: "string", size: 255, required: true },
      { key: "sender_id", type: "string", size: 255, required: true },
      { key: "sender_name", type: "string", size: 255, required: true },
      { key: "text", type: "string", size: 5000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "thread_id", type: "key", attributes: ["thread_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 11. blocks
  {
    id: "blocks",
    name: "Blocks",
    attributes: [
      { key: "blocker_id", type: "string", size: 255, required: true },
      { key: "blocked_id", type: "string", size: 255, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "blocker_id", type: "key", attributes: ["blocker_id"] },
      { key: "blocked_id", type: "key", attributes: ["blocked_id"] },
    ],
  },

  // 12. projects
  {
    id: "projects",
    name: "Projects",
    attributes: [
      { key: "name", type: "string", size: 255, required: true },
      { key: "description", type: "string", size: 5000, required: false },
      { key: "strand", type: "string", size: 1, required: true, enum: ["N", "E", "S", "W"] },
      { key: "owner_id", type: "string", size: 255, required: true },
      { key: "owner_name", type: "string", size: 255, required: true },
      { key: "members", type: "string", size: 36, required: false, array: true },
      { key: "member_count", type: "integer", required: false, default: 0 },
      { key: "status", type: "string", size: 20, required: true, enum: ["active", "completed", "paused"] },
      { key: "tags", type: "string", size: 50, required: false, array: true },
      { key: "search_index", type: "string", size: 10000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "owner_id", type: "key", attributes: ["owner_id"] },
      { key: "strand", type: "key", attributes: ["strand"] },
      { key: "status", type: "key", attributes: ["status"] },
      { key: "member_count", type: "key", attributes: ["member_count"] },
    ],
  },

  // 13. project-members
  {
    id: "project-members",
    name: "Project Members",
    attributes: [
      { key: "project_id", type: "string", size: 255, required: true },
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "role", type: "string", size: 50, required: false },
      { key: "joined_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "project_id", type: "key", attributes: ["project_id"] },
      { key: "user_id", type: "key", attributes: ["user_id"] },
    ],
  },

  // 14. tasks
  {
    id: "tasks",
    name: "Tasks",
    attributes: [
      { key: "project_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "description", type: "string", size: 5000, required: false },
      { key: "status", type: "string", size: 20, required: true, enum: ["todo", "in-progress", "done"] },
      { key: "assignee_id", type: "string", size: 255, required: true },
      { key: "assignee_name", type: "string", size: 255, required: true },
      { key: "priority", type: "string", size: 10, required: false, enum: ["low", "medium", "high"] },
      { key: "created_by", type: "string", size: 255, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "project_id", type: "key", attributes: ["project_id"] },
      { key: "assignee_id", type: "key", attributes: ["assignee_id"] },
      { key: "status", type: "key", attributes: ["status"] },
    ],
  },

  // 15. badges
  {
    id: "badges",
    name: "Badges",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "badge_id", type: "string", size: 255, required: true },
      { key: "badge_name", type: "string", size: 255, required: true },
      { key: "badge_description", type: "string", size: 1000, required: true },
      { key: "badge_icon", type: "string", size: 255, required: true },
      { key: "badge_category", type: "string", size: 20, required: true, enum: ["milestone", "social", "creation", "impact", "streak", "special"] },
      { key: "earned_at_ms", type: "integer", required: false },
      { key: "metadata", type: "json", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "badge_id", type: "key", attributes: ["badge_id"] },
    ],
  },

  // 16. events
  {
    id: "events",
    name: "Events",
    attributes: [
      { key: "title", type: "string", size: 255, required: true },
      { key: "description", type: "string", size: 5000, required: false },
      { key: "strand", type: "string", size: 1, required: true, enum: ["N", "E", "S", "W"] },
      { key: "host_id", type: "string", size: 255, required: true },
      { key: "host_name", type: "string", size: 255, required: true },
      { key: "date", type: "string", size: 255, required: true },
      { key: "time", type: "string", size: 255, required: true },
      { key: "location", type: "string", size: 500, required: false },
      { key: "is_online", type: "boolean", required: true, default: false },
      { key: "online_url", type: "string", size: 1000, required: false },
      { key: "rsvp_count", type: "integer", required: false, default: 0 },
      { key: "tags", type: "string", size: 50, required: false, array: true },
      { key: "search_index", type: "string", size: 10000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "host_id", type: "key", attributes: ["host_id"] },
      { key: "strand", type: "key", attributes: ["strand"] },
      { key: "date", type: "key", attributes: ["date"] },
      { key: "is_online", type: "key", attributes: ["is_online"] },
    ],
  },

  // 17. event-rsvps
  {
    id: "event-rsvps",
    name: "Event RSVPs",
    attributes: [
      { key: "event_id", type: "string", size: 255, required: true },
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "user_name", type: "string", size: 255, required: true },
      { key: "status", type: "string", size: 20, required: true, enum: ["going", "interested", "not_going"] },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "event_id", type: "key", attributes: ["event_id"] },
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "status", type: "key", attributes: ["status"] },
    ],
  },

  // 18. documents
  {
    id: "documents",
    name: "Documents",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "body", type: "string", size: 50000, required: false },
      { key: "word_count", type: "integer", required: false, default: 0 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 19. slideshows
  {
    id: "slideshows",
    name: "Slideshows",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "template_id", type: "string", size: 255, required: false },
      { key: "slides", type: "json", required: false },
      { key: "slide_count", type: "integer", required: false, default: 0 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 20. tables
  {
    id: "tables",
    name: "Tables",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "rows", type: "integer", required: false, default: 0 },
      { key: "cols", type: "integer", required: false, default: 0 },
      { key: "data", type: "json", required: false },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 21. code-snippets
  {
    id: "code-snippets",
    name: "Code Snippets",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "language", type: "string", size: 100, required: true },
      { key: "code", type: "string", size: 50000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "language", type: "key", attributes: ["language"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 22. designs
  {
    id: "designs",
    name: "Designs",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "elements", type: "json", required: false },
      { key: "canvas_width", type: "integer", required: false, default: 1920 },
      { key: "canvas_height", type: "integer", required: false, default: 1080 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 23. films
  {
    id: "films",
    name: "Films",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "scenes", type: "json", required: false },
      { key: "scene_count", type: "integer", required: false, default: 0 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
    ],
  },

  // 24. call-signals (critical for video calls)
  {
    id: "call-signals",
    name: "Call Signals",
    attributes: [
      { key: "room_id", type: "string", size: 255, required: true },
      { key: "sender_id", type: "string", size: 255, required: true },
      { key: "kind", type: "string", size: 20, required: true, enum: ["presence", "rtc", "chat", "whiteboard", "timer", "reaction", "breakout"] },
      { key: "payload", type: "string", size: 10000, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "room_id", type: "key", attributes: ["room_id"] },
      { key: "created_at_ms", type: "key", attributes: ["created_at_ms"] },
      { key: "sender_id", type: "key", attributes: ["sender_id"] },
    ],
  },

  // 25. privacy-settings
  {
    id: "privacy-settings",
    name: "Privacy Settings",
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "settings", type: "json", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key", attributes: ["user_id"] },
    ],
  },
];

async function createCollection(col) {
  try {
    // Check if exists
    try {
      await databases.getCollection(databaseId, col.id);
      console.log(`⏭️  Collection "${col.id}" already exists, skipping...`);
      return;
    } catch (e) {
      if (e.code !== 404) throw e;
    }

    console.log(`📦 Creating collection: ${col.id}`);
    const collection = await databases.createCollection(databaseId, col.id, col.name, permissions, false, true);

    // Create attributes
    for (const attr of col.attributes) {
      try {
        if (attr.type === "string") {
          if (attr.array) {
            await databases.createStringAttribute(databaseId, col.id, attr.key, attr.size, attr.required, attr.default || undefined, attr.array, attr.enum || undefined);
          } else {
            await databases.createStringAttribute(databaseId, col.id, attr.key, attr.size, attr.required, attr.default || undefined, false, attr.enum || undefined);
          }
        } else if (attr.type === "integer") {
          await databases.createIntegerAttribute(databaseId, col.id, attr.key, attr.required, attr.default || undefined, undefined, undefined, attr.array || false);
        } else if (attr.type === "boolean") {
          await databases.createBooleanAttribute(databaseId, col.id, attr.key, attr.required, attr.default || undefined, attr.array || false);
        } else if (attr.type === "json") {
          await databases.createJsonAttribute(databaseId, col.id, attr.key, attr.required, attr.array || false);
        }
        console.log(`   ✅ Attribute: ${attr.key}`);
      } catch (e) {
        if (e.code === 409) {
          console.log(`   ⏭️  Attribute "${attr.key}" already exists`);
        } else {
          console.error(`   ❌ Failed to create attribute "${attr.key}":`, e.message);
        }
      }
    }

    // Create indexes (wait a bit for attributes to be ready)
    await new Promise(r => setTimeout(r, 2000));
    for (const idx of col.indexes) {
      try {
        if (idx.type === "key") {
          await databases.createIndex(databaseId, col.id, idx.key, "key", idx.attributes);
        } else if (idx.type === "fulltext") {
          await databases.createIndex(databaseId, col.id, idx.key, "fulltext", idx.attributes);
        }
        console.log(`   ✅ Index: ${idx.key}`);
      } catch (e) {
        if (e.code === 409) {
          console.log(`   ⏭️  Index "${idx.key}" already exists`);
        } else {
          console.error(`   ❌ Failed to create index "${idx.key}":`, e.message);
        }
      }
    }

    console.log(`✅ Collection "${col.id}" created successfully\n`);
  } catch (error) {
    console.error(`❌ Failed to create collection "${col.id}":`, error.message);
  }
}

async function main() {
  console.log("🚀 Starting Appwrite collection creation...\n");
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log(`📁 Database: ${databaseId}\n`);

  // Verify database exists, create if not
  try {
    await databases.get(databaseId);
    console.log(`✅ Database "${databaseId}" exists\n`);
  } catch (e) {
    if (e.code === 404) {
      console.log(`📦 Creating database: ${databaseId}`);
      try {
        await databases.create(databaseId, databaseId);
        console.log(`✅ Database "${databaseId}" created\n`);
      } catch (createError) {
        console.error(`❌ Failed to create database:`, createError.message);
        console.error(`   Create it manually in Appwrite Console: Databases → Create Database → ID: ${databaseId}`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Error checking database:`, e.message);
      process.exit(1);
    }
  }

  for (const col of collections) {
    await createCollection(col);
  }

  console.log("🎉 All collections processed!");
  console.log("\n📋 Next steps:");
  console.log("   1. Create storage bucket 'changers-media' in Appwrite Console");
  console.log("   2. Set bucket permissions: Read/Write for users");
  console.log("   3. Run: cd changers/web && npm run dev");
  console.log("   4. Test: curl -H \"Cookie: your_session\" http://localhost:3000/api/health");
}

main().catch(console.error);