import { listCollections, getAttributeLimitStatus } from "../client";
import type { AttributeLimitStatus } from "../types";

export async function checkAllAttributeLimits(): Promise<AttributeLimitStatus[]> {
  const collections = await listCollections();
  const results: AttributeLimitStatus[] = [];

  for (const col of collections) {
    try {
      const status = await getAttributeLimitStatus(col.$id);
      results.push(status);
    } catch (error) {
      console.error(`Failed to check attribute limit for ${col.$id}:`, error);
    }
  }

  return results;
}

export async function getCollectionsAtLimit(): Promise<AttributeLimitStatus[]> {
  const allLimits = await checkAllAttributeLimits();
  return allLimits.filter((l) => l.atLimit);
}

export async function getCollectionsNearLimit(threshold = 85): Promise<AttributeLimitStatus[]> {
  const allLimits = await checkAllAttributeLimits();
  return allLimits.filter((l) => (l.currentCount / l.maxCount) * 100 >= threshold);
}

export async function suggestAttributesToArchive(collectionId: string, neededSlots: number): Promise<string[]> {
  const { listAttributes } = await import("../client");
  const attrs = await listAttributes(collectionId);
  
  const userAttrs = attrs.filter((a) => !a.key.startsWith("$") && a.status === "available");
  
  const candidates = userAttrs
    .filter((a) => {
      // Don't suggest archiving critical attributes
      const criticalKeys = ["user_id", "created_at_ms", "updated_at_ms", "search_index", "is_admin"];
      return !criticalKeys.includes(a.key);
    })
    .sort((a, b) => {
      // Prefer archiving larger attributes first
      const aSize = a.size || 0;
      const bSize = b.size || 0;
      return bSize - aSize;
    });

  return candidates.slice(0, neededSlots).map((a) => a.key);
}

export async function archiveAttribute(collectionId: string, key: string): Promise<boolean> {
  const { deleteAttribute } = await import("../client");
  try {
    await deleteAttribute(collectionId, key);
    return true;
  } catch (error) {
    console.error(`Failed to archive attribute ${key} on ${collectionId}:`, error);
    return false;
  }
}

export async function freeAttributeSlots(collectionId: string, neededSlots: number): Promise<{ freed: string[]; failed: string[] }> {
  const suggestions = await suggestAttributesToArchive(collectionId, neededSlots);
  const freed: string[] = [];
  const failed: string[] = [];

  for (const key of suggestions) {
    const success = await archiveAttribute(collectionId, key);
    if (success) {
      freed.push(key);
    } else {
      failed.push(key);
    }
  }

  return { freed, failed };
}