import { dbAgentConfig } from "../config";

export const COLLECTION_DEFINITIONS = {
  profiles: {
    id: "profiles",
    name: "Profiles",
    permissions: ["read(\"any\")", "write(\"users\")"],
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
      { key: "push_subscription", type: "string", size: 5000, required: false },
      { key: "search_index", type: "string", size: 10000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "is_admin", type: "key" as const, attributes: ["is_admin"] },
      { key: "search_index", type: "fulltext" as const, attributes: ["search_index"] },
    ],
  },

  posts: {
    id: "posts",
    name: "Posts",
    permissions: ["read(\"any\")", "write(\"users\")"],
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
      { key: "poll_votes", type: "string", size: 4096, required: false },
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
      { key: "author_id", type: "key" as const, attributes: ["author_id"] },
      { key: "strand", type: "key" as const, attributes: ["strand"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  comments: {
    id: "comments",
    name: "Comments",
    permissions: ["read(\"any\")", "write(\"users\")"],
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
      { key: "post_id", type: "key" as const, attributes: ["post_id"] },
      { key: "author_id", type: "key" as const, attributes: ["author_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  notifications: {
    id: "notifications",
    name: "Notifications",
    permissions: ["read(\"any\")", "write(\"users\")"],
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
      { key: "read", type: "key" as const, attributes: ["read"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  follows: {
    id: "follows",
    name: "Follows",
    permissions: ["read(\"any\")", "write(\"users\")"],
    attributes: [
      { key: "follower_id", type: "string", size: 255, required: true },
      { key: "followee_id", type: "string", size: 255, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "follower_id", type: "key" as const, attributes: ["follower_id"] },
      { key: "followee_id", type: "key" as const, attributes: ["followee_id"] },
    ],
  },

  "saved-posts": {
    id: "saved-posts",
    name: "Saved Posts",
    permissions: ["read(\"any\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "post_id", type: "string", size: 255, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "post_id", type: "key" as const, attributes: ["post_id"] },
    ],
  },

  rooms: {
    id: "rooms",
    name: "Rooms",
    permissions: ["read(\"any\")", "write(\"users\")"],
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
      { key: "owner_id", type: "key" as const, attributes: ["owner_id"] },
      { key: "strand", type: "key" as const, attributes: ["strand"] },
      { key: "member_count", type: "key" as const, attributes: ["member_count"] },
    ],
  },

  "room-messages": {
    id: "room-messages",
    name: "Room Messages",
    permissions: ["read(\"any\")", "write(\"users\")"],
    attributes: [
      { key: "room_id", type: "string", size: 255, required: true },
      { key: "sender_id", type: "string", size: 255, required: true },
      { key: "sender_name", type: "string", size: 255, required: true },
      { key: "text", type: "string", size: 5000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "room_id", type: "key" as const, attributes: ["room_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  threads: {
    id: "threads",
    name: "Threads",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "participants", type: "string", size: 36, required: true, array: true },
      { key: "last_message", type: "string", size: 500, required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "updated_at_ms", type: "key" as const, attributes: ["updated_at_ms"] },
    ],
  },

  "thread-messages": {
    id: "thread-messages",
    name: "Thread Messages",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "thread_id", type: "string", size: 255, required: true },
      { key: "sender_id", type: "string", size: 255, required: true },
      { key: "sender_name", type: "string", size: 255, required: true },
      { key: "text", type: "string", size: 5000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "thread_id", type: "key" as const, attributes: ["thread_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  blocks: {
    id: "blocks",
    name: "Blocks",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "blocker_id", type: "string", size: 255, required: true },
      { key: "blocked_id", type: "string", size: 255, required: true },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "blocker_id", type: "key" as const, attributes: ["blocker_id"] },
      { key: "blocked_id", type: "key" as const, attributes: ["blocked_id"] },
    ],
  },

  projects: {
    id: "projects",
    name: "Projects",
    permissions: ["read(\"any\")", "write(\"users\")"],
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
      { key: "owner_id", type: "key" as const, attributes: ["owner_id"] },
      { key: "strand", type: "key" as const, attributes: ["strand"] },
      { key: "status", type: "key" as const, attributes: ["status"] },
      { key: "member_count", type: "key" as const, attributes: ["member_count"] },
    ],
  },

  "project-members": {
    id: "project-members",
    name: "Project Members",
    permissions: ["read(\"any\")", "write(\"users\")"],
    attributes: [
      { key: "project_id", type: "string", size: 255, required: true },
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "role", type: "string", size: 50, required: false },
      { key: "joined_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "project_id", type: "key" as const, attributes: ["project_id"] },
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
    ],
  },

  tasks: {
    id: "tasks",
    name: "Tasks",
    permissions: ["read(\"any\")", "write(\"users\")"],
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
      { key: "project_id", type: "key" as const, attributes: ["project_id"] },
      { key: "assignee_id", type: "key" as const, attributes: ["assignee_id"] },
      { key: "status", type: "key" as const, attributes: ["status"] },
    ],
  },

  badges: {
    id: "badges",
    name: "Badges",
    permissions: ["read(\"any\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "badge_id", type: "string", size: 255, required: true },
      { key: "badge_name", type: "string", size: 255, required: true },
      { key: "badge_description", type: "string", size: 1000, required: true },
      { key: "badge_icon", type: "string", size: 255, required: true },
      { key: "badge_category", type: "string", size: 20, required: true, enum: ["milestone", "social", "creation", "impact", "streak", "special"] },
      { key: "earned_at_ms", type: "integer", required: false },
      { key: "metadata", type: "string", size: 4096, required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "badge_id", type: "key" as const, attributes: ["badge_id"] },
    ],
  },

  events: {
    id: "events",
    name: "Events",
    permissions: ["read(\"any\")", "write(\"users\")"],
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
      { key: "host_id", type: "key" as const, attributes: ["host_id"] },
      { key: "strand", type: "key" as const, attributes: ["strand"] },
      { key: "date", type: "key" as const, attributes: ["date"] },
      { key: "is_online", type: "key" as const, attributes: ["is_online"] },
    ],
  },

  "event-rsvps": {
    id: "event-rsvps",
    name: "Event RSVPs",
    permissions: ["read(\"any\")", "write(\"users\")"],
    attributes: [
      { key: "event_id", type: "string", size: 255, required: true },
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "user_name", type: "string", size: 255, required: true },
      { key: "status", type: "string", size: 20, required: true, enum: ["going", "interested", "not_going"] },
      { key: "created_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "event_id", type: "key" as const, attributes: ["event_id"] },
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "status", type: "key" as const, attributes: ["status"] },
    ],
  },

  documents: {
    id: "documents",
    name: "Documents",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "body", type: "string", size: 50000, required: false },
      { key: "word_count", type: "integer", required: false, default: 0 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  slideshows: {
    id: "slideshows",
    name: "Slideshows",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "template_id", type: "string", size: 255, required: false },
      { key: "slide_count", type: "integer", required: false, default: 0 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  tables: {
    id: "tables",
    name: "Tables",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "rows", type: "integer", required: false, default: 0 },
      { key: "cols", type: "integer", required: false, default: 0 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  "code-snippets": {
    id: "code-snippets",
    name: "Code Snippets",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "language", type: "string", size: 100, required: true },
      { key: "code", type: "string", size: 50000, required: true },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "language", type: "key" as const, attributes: ["language"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  designs: {
    id: "designs",
    name: "Designs",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "canvas_width", type: "integer", required: false, default: 1920 },
      { key: "canvas_height", type: "integer", required: false, default: 1080 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  films: {
    id: "films",
    name: "Films",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "scene_count", type: "integer", required: false, default: 0 },
      { key: "created_at_ms", type: "integer", required: false },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
    ],
  },

  "call-signals": {
    id: "call-signals",
    name: "Call Signals",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "room_id", type: "string", size: 255, required: true },
      { key: "sender_id", type: "string", size: 255, required: true },
      { key: "kind", type: "string", size: 20, required: true, enum: ["presence", "rtc", "chat", "whiteboard", "timer", "reaction", "breakout"] },
      { key: "payload", type: "string", size: 10000, required: true },
      { key: "created_at_ms", type: "integer", required: true },
    ],
    indexes: [
      { key: "room_id", type: "key" as const, attributes: ["room_id"] },
      { key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
      { key: "sender_id", type: "key" as const, attributes: ["sender_id"] },
    ],
  },

  "privacy-settings": {
    id: "privacy-settings",
    name: "Privacy Settings",
    permissions: ["read(\"users\")", "write(\"users\")"],
    attributes: [
      { key: "user_id", type: "string", size: 255, required: true },
      { key: "updated_at_ms", type: "integer", required: false },
    ],
    indexes: [
      { key: "user_id", type: "key" as const, attributes: ["user_id"] },
    ],
  },
} as const;

export type CollectionName = keyof typeof COLLECTION_DEFINITIONS;

export function getCollectionDefinition(name: CollectionName) {
  return COLLECTION_DEFINITIONS[name];
}

export function getAllCollectionDefinitions() {
  return Object.values(COLLECTION_DEFINITIONS);
}

export function getExpectedCollectionIds(): string[] {
  return Object.values(dbAgentConfig.appwrite.collections);
}