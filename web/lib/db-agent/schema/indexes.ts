import { createIndex, listIndexes } from "../client";
import { getAllCollectionDefinitions } from "./collections";

interface IndexDefinition {
  key: string;
  type: "key" | "fulltext";
  attributes: readonly string[];
}

export async function ensureCollectionIndexes(collectionId: string): Promise<{ created: string[]; skipped: string[]; failed: string[] }> {
  const definitions = getAllCollectionDefinitions();
  const definition = definitions.find((d) => d.id === collectionId);
  
  if (!definition) {
    return { created: [], skipped: [], failed: [`Collection ${collectionId} not found in definitions`] };
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const idx of definition.indexes) {
    try {
      const existingIndexes = await listIndexes(collectionId);
      const exists = existingIndexes.some((i) => i.key === idx.key);
      
      if (exists) {
        skipped.push(idx.key);
        continue;
      }

      await createIndex(collectionId, idx.key, idx.type, idx.attributes);
      created.push(idx.key);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("409") || msg.includes("already exists")) {
        skipped.push(idx.key);
      } else {
        failed.push(`${idx.key}: ${msg}`);
      }
    }
  }

  return { created, skipped, failed };
}

export async function ensureAllCollectionIndexes(): Promise<Record<string, { created: string[]; skipped: string[]; failed: string[] }>> {
  const results: Record<string, { created: string[]; skipped: string[]; failed: string[] }> = {};
  
  for (const def of getAllCollectionDefinitions()) {
    console.log(`\n🔍 Ensuring indexes for ${def.name}...`);
    const result = await ensureCollectionIndexes(def.id);
    results[def.id] = result;
    
    if (result.created.length > 0) {
      console.log(`   ✅ Created: ${result.created.join(", ")}`);
    }
    if (result.skipped.length > 0) {
      console.log(`   ⏭️  Skipped (exist): ${result.skipped.join(", ")}`);
    }
    if (result.failed.length > 0) {
      console.error(`   ❌ Failed: ${result.failed.join(", ")}`);
    }
  }
  
  return results;
}

export async function createMissingIndexes(indexes: IndexDefinition[]): Promise<Record<string, { created: string[]; failed: string[] }>> {
  const results: Record<string, { created: string[]; failed: string[] }> = {};

  for (const idx of indexes) {
    // Heuristic: collectionId from key prefix, but better to pass explicitly
    void idx.key.split("-")[0];
    // For now, we'll just try all collections
  }

  return results;
}

export async function createSpecificIndexes(indexDefinitions: Array<{ collectionId: string; key: string; type: "key" | "fulltext"; attributes: string[] }>): Promise<{ created: string[]; failed: string[] }> {
  const created: string[] = [];
  const failed: string[] = [];

  for (const idx of indexDefinitions) {
    try {
      const existingIndexes = await listIndexes(idx.collectionId);
      const exists = existingIndexes.some((i) => i.key === idx.key);
      
      if (exists) {
        console.log(`   ⏭️  Index "${idx.key}" already exists on ${idx.collectionId}`);
        continue;
      }

      await createIndex(idx.collectionId, idx.key, idx.type, idx.attributes);
      console.log(`   ✅ Created index: ${idx.key} on ${idx.collectionId}`);
      created.push(`${idx.collectionId}.${idx.key}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("409") || msg.includes("already exists")) {
        console.log(`   ⏭️  Index "${idx.key}" already exists on ${idx.collectionId}`);
      } else {
        console.error(`   ❌ Failed to create index "${idx.key}" on ${idx.collectionId}: ${msg}`);
        failed.push(`${idx.collectionId}.${idx.key}: ${msg}`);
      }
    }
  }

  return { created, failed };
}

export const REQUIRED_INDEXES = [
  { collectionId: "notifications", key: "type", type: "key" as const, attributes: ["type"] },
  { collectionId: "rooms", key: "strand", type: "key" as const, attributes: ["strand"] },
  { collectionId: "rooms", key: "search_index", type: "fulltext" as const, attributes: ["search_index"] },
  { collectionId: "projects", key: "strand", type: "key" as const, attributes: ["strand"] },
  { collectionId: "projects", key: "status", type: "key" as const, attributes: ["status"] },
  { collectionId: "tasks", key: "status", type: "key" as const, attributes: ["status"] },
  { collectionId: "tasks", key: "priority", type: "key" as const, attributes: ["priority"] },
  { collectionId: "badges", key: "badge_category", type: "key" as const, attributes: ["badge_category"] },
  { collectionId: "events", key: "strand", type: "key" as const, attributes: ["strand"] },
  { collectionId: "events", key: "search_index", type: "fulltext" as const, attributes: ["search_index"] },
  { collectionId: "event-rsvps", key: "status", type: "key" as const, attributes: ["status"] },
  { collectionId: "call-signals", key: "kind", type: "key" as const, attributes: ["kind"] },
  { collectionId: "profiles", key: "is_admin", type: "key" as const, attributes: ["is_admin"] },
  { collectionId: "profiles", key: "search_index", type: "fulltext" as const, attributes: ["search_index"] },
  { collectionId: "posts", key: "author_id", type: "key" as const, attributes: ["author_id"] },
  { collectionId: "posts", key: "strand", type: "key" as const, attributes: ["strand"] },
  { collectionId: "posts", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "comments", key: "post_id", type: "key" as const, attributes: ["post_id"] },
  { collectionId: "comments", key: "author_id", type: "key" as const, attributes: ["author_id"] },
  { collectionId: "comments", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "follows", key: "follower_id", type: "key" as const, attributes: ["follower_id"] },
  { collectionId: "follows", key: "followee_id", type: "key" as const, attributes: ["followee_id"] },
  { collectionId: "saved-posts", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "saved-posts", key: "post_id", type: "key" as const, attributes: ["post_id"] },
  { collectionId: "room-messages", key: "room_id", type: "key" as const, attributes: ["room_id"] },
  { collectionId: "room-messages", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "threads", key: "updated_at_ms", type: "key" as const, attributes: ["updated_at_ms"] },
  { collectionId: "thread-messages", key: "thread_id", type: "key" as const, attributes: ["thread_id"] },
  { collectionId: "thread-messages", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "blocks", key: "blocker_id", type: "key" as const, attributes: ["blocker_id"] },
  { collectionId: "blocks", key: "blocked_id", type: "key" as const, attributes: ["blocked_id"] },
  { collectionId: "projects", key: "owner_id", type: "key" as const, attributes: ["owner_id"] },
  { collectionId: "projects", key: "member_count", type: "key" as const, attributes: ["member_count"] },
  { collectionId: "project-members", key: "project_id", type: "key" as const, attributes: ["project_id"] },
  { collectionId: "project-members", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "tasks", key: "project_id", type: "key" as const, attributes: ["project_id"] },
  { collectionId: "tasks", key: "assignee_id", type: "key" as const, attributes: ["assignee_id"] },
  { collectionId: "badges", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "badges", key: "badge_id", type: "key" as const, attributes: ["badge_id"] },
  { collectionId: "events", key: "host_id", type: "key" as const, attributes: ["host_id"] },
  { collectionId: "events", key: "date", type: "key" as const, attributes: ["date"] },
  { collectionId: "events", key: "is_online", type: "key" as const, attributes: ["is_online"] },
  { collectionId: "event-rsvps", key: "event_id", type: "key" as const, attributes: ["event_id"] },
  { collectionId: "event-rsvps", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "documents", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "documents", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "slideshows", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "slideshows", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "tables", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "tables", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "code-snippets", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "code-snippets", key: "language", type: "key" as const, attributes: ["language"] },
  { collectionId: "code-snippets", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "designs", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "designs", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "films", key: "user_id", type: "key" as const, attributes: ["user_id"] },
  { collectionId: "films", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "call-signals", key: "room_id", type: "key" as const, attributes: ["room_id"] },
  { collectionId: "call-signals", key: "created_at_ms", type: "key" as const, attributes: ["created_at_ms"] },
  { collectionId: "call-signals", key: "sender_id", type: "key" as const, attributes: ["sender_id"] },
  { collectionId: "privacy-settings", key: "user_id", type: "key" as const, attributes: ["user_id"] },
];

export async function ensureRequiredIndexes(): Promise<{ created: string[]; failed: string[] }> {
  console.log("\n🔍 Ensuring all required indexes...");
  return createSpecificIndexes(REQUIRED_INDEXES);
}