import {
  createStringAttribute,
  createIntegerAttribute,
  createBooleanAttribute,
  createJsonAttribute,
  waitForAttribute,
  listAttributes,
} from "../client";
import { getCollectionDefinition, getAllCollectionDefinitions, type CollectionName } from "./collections";

interface AttributeDefinition {
  key: string;
  type: "string" | "integer" | "boolean" | "json" | "float" | "email" | "url" | "datetime" | "relationship";
  size?: number;
  required: boolean;
  default?: unknown;
  array?: boolean;
  enum?: readonly string[];
  min?: number;
  max?: number;
  relatedCollection?: string;
  relationType?: "oneToOne" | "oneToMany" | "manyToMany";
  twoWay?: boolean;
  keyOnRelated?: string;
  onDelete?: "cascade" | "restrict" | "setNull";
}

export async function ensureCollectionAttributes(collectionName: CollectionName): Promise<{ created: string[]; skipped: string[]; failed: string[] }> {
  const definition = getCollectionDefinition(collectionName);
  const collectionId = definition.id;
  
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const attr of definition.attributes) {
    try {
      const existingAttrs = await listAttributes(collectionId);
      const exists = existingAttrs.some((a) => a.key === attr.key);
      
      if (exists) {
        skipped.push(attr.key);
        continue;
      }

      await createAttributeFromDefinition(collectionId, attr);
      await waitForAttribute(collectionId, attr.key, 30_000);
      created.push(attr.key);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("409") || msg.includes("already exists")) {
        skipped.push(attr.key);
      } else {
        failed.push(`${attr.key}: ${msg}`);
      }
    }
  }

  return { created, skipped, failed };
}

async function createAttributeFromDefinition(collectionId: string, attr: AttributeDefinition): Promise<void> {
  switch (attr.type) {
    case "string":
      await createStringAttribute(
        collectionId,
        attr.key,
        attr.size || 255,
        attr.required,
        attr.default as string | undefined,
        attr.array || false,
        attr.enum
      );
      break;
    case "integer":
      await createIntegerAttribute(
        collectionId,
        attr.key,
        attr.required,
        attr.default as number | undefined,
        attr.min,
        attr.max,
        attr.array || false
      );
      break;
    case "boolean":
      await createBooleanAttribute(
        collectionId,
        attr.key,
        attr.required,
        attr.default as boolean | undefined,
        attr.array || false
      );
      break;
    case "json":
      await createJsonAttribute(
        collectionId,
        attr.key,
        attr.required,
        attr.array || false
      );
      break;
    case "float":
      const { createFloatAttribute } = await import("../client");
      await createFloatAttribute(
        collectionId,
        attr.key,
        attr.required,
        attr.default as number | undefined,
        attr.min,
        attr.max,
        attr.array || false
      );
      break;
    case "email":
      const { createEmailAttribute } = await import("../client");
      await createEmailAttribute(
        collectionId,
        attr.key,
        attr.required,
        attr.default as string | undefined,
        attr.array || false
      );
      break;
    case "url":
      const { createUrlAttribute } = await import("../client");
      await createUrlAttribute(
        collectionId,
        attr.key,
        attr.required,
        attr.default as string | undefined,
        attr.array || false
      );
      break;
    case "datetime":
      const { createDatetimeAttribute } = await import("../client");
      await createDatetimeAttribute(
        collectionId,
        attr.key,
        attr.required,
        attr.default as string | undefined,
        attr.array || false
      );
      break;
    case "relationship":
      const { createRelationshipAttribute } = await import("../client");
      await createRelationshipAttribute(
        collectionId,
        attr.key,
        attr.relatedCollection!,
        attr.relationType!,
        attr.twoWay ?? false,
        attr.keyOnRelated,
        attr.onDelete
      );
      break;
  }
}

export async function ensureAllCollectionAttributes(): Promise<Record<string, { created: string[]; skipped: string[]; failed: string[] }>> {
  const results: Record<string, { created: string[]; skipped: string[]; failed: string[] }> = {};
  
  for (const def of getAllCollectionDefinitions()) {
    console.log(`\n📦 Ensuring attributes for ${def.name}...`);
    const result = await ensureCollectionAttributes(def.id as CollectionName);
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

export async function addMissingAttribute(
  collectionId: string,
  attr: AttributeDefinition
): Promise<boolean> {
  try {
    const existingAttrs = await listAttributes(collectionId);
    const exists = existingAttrs.some((a) => a.key === attr.key);
    
    if (exists) {
      console.log(`   ⏭️  Attribute "${attr.key}" already exists`);
      return true;
    }

    await createAttributeFromDefinition(collectionId, attr);
    await waitForAttribute(collectionId, attr.key, 30_000);
    console.log(`   ✅ Created attribute: ${attr.key}`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("409") || msg.includes("already exists")) {
      console.log(`   ⏭️  Attribute "${attr.key}" already exists`);
      return true;
    }
    if (msg.includes("maximum number or size")) {
      console.log(`   ⚠️  Attribute limit reached for ${collectionId}, cannot add "${attr.key}"`);
      return false;
    }
    console.error(`   ❌ Failed to create attribute "${attr.key}": ${msg}`);
    return false;
  }
}

export async function fixEnumAttributes(): Promise<Record<string, { created: string[]; failed: string[] }>> {
  const enumFixes: Record<string, AttributeDefinition[]> = {
    notifications: [
      { key: "type", type: "string", size: 20, required: true, enum: ["like", "comment", "follow", "system", "bot", "poll_vote", "project_invite", "event_reminder"] },
    ],
    rooms: [
      { key: "strand", type: "string", size: 1, required: true, enum: ["N", "E", "S", "W"] },
    ],
    projects: [
      { key: "strand", type: "string", size: 1, required: true, enum: ["N", "E", "S", "W"] },
      { key: "status", type: "string", size: 20, required: true, enum: ["active", "completed", "paused"] },
    ],
    tasks: [
      { key: "status", type: "string", size: 20, required: true, enum: ["todo", "in-progress", "done"] },
      { key: "priority", type: "string", size: 10, required: false, enum: ["low", "medium", "high"] },
    ],
    badges: [
      { key: "badge_category", type: "string", size: 20, required: true, enum: ["milestone", "social", "creation", "impact", "streak", "special"] },
    ],
    events: [
      { key: "strand", type: "string", size: 1, required: true, enum: ["N", "E", "S", "W"] },
    ],
    "event-rsvps": [
      { key: "status", type: "string", size: 20, required: true, enum: ["going", "interested", "not_going"] },
    ],
    "call-signals": [
      { key: "kind", type: "string", size: 20, required: true, enum: ["presence", "rtc", "chat", "whiteboard", "timer", "reaction", "breakout"] },
    ],
    profiles: [
      { key: "privacy", type: "string", size: 10, required: false, enum: ["public", "followers", "private"] },
      { key: "theme", type: "string", size: 10, required: false, enum: ["moss", "ocean", "sunset", "rose"] },
    ],
    posts: [
      { key: "strand", type: "string", size: 1, required: true, enum: ["N", "E", "S", "W"] },
    ],
  };

  const results: Record<string, { created: string[]; failed: string[] }> = {};

  for (const [collectionId, attrs] of Object.entries(enumFixes)) {
    results[collectionId] = { created: [], failed: [] };
    console.log(`\n📝 Fixing enum attributes for ${collectionId}...`);
    
    for (const attr of attrs) {
      try {
        const existingAttrs = await listAttributes(collectionId);
        const existing = existingAttrs.find((a) => a.key === attr.key);
        
        if (existing) {
          if (existing.status === "available") {
            console.log(`   ⏭️  ${attr.key} already exists (no enum validation at DB level)`);
            results[collectionId].created.push(attr.key);
          } else {
            await waitForAttribute(collectionId, attr.key, 30_000);
            results[collectionId].created.push(attr.key);
          }
        } else {
          await createAttributeFromDefinition(collectionId, attr);
          await waitForAttribute(collectionId, attr.key, 30_000);
          console.log(`   ✅ Created enum attr: ${attr.key}`);
          results[collectionId].created.push(attr.key);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Failed enum attr "${attr.key}": ${msg}`);
        results[collectionId].failed.push(attr.key);
      }
    }
  }

  return results;
}

export async function fixJsonAttributes(): Promise<Record<string, { created: string[]; failed: string[] }>> {
  return {};
}

export async function addSearchIndexAttributes(): Promise<Record<string, { created: string[]; failed: string[] }>> {
  const searchIndexFixes: Record<string, AttributeDefinition[]> = {
    rooms: [
      { key: "search_index", type: "string", size: 10000, required: true },
    ],
    events: [
      { key: "search_index", type: "string", size: 10000, required: true },
    ],
  };

  const results: Record<string, { created: string[]; failed: string[] }> = {};

  for (const [collectionId, attrs] of Object.entries(searchIndexFixes)) {
    results[collectionId] = { created: [], failed: [] };
    console.log(`\n📝 Adding search_index for ${collectionId}...`);
    
    for (const attr of attrs) {
      const success = await addMissingAttribute(collectionId, attr);
      if (success) {
        results[collectionId].created.push(attr.key);
      } else {
        results[collectionId].failed.push(attr.key);
      }
    }
  }

  return results;
}