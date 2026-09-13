import { createCollection, getCollection, listCollections } from "../client";
import { getAllCollectionDefinitions } from "../schema/collections";

export async function ensureAllCollections(): Promise<void> {
  const definitions = getAllCollectionDefinitions();
  const existingCollections = await listCollections();
  const existingIds = new Set(existingCollections.map((c) => c.$id));

  for (const def of definitions) {
    if (existingIds.has(def.id)) {
      console.log(`   ⏭️  Collection "${def.name}" already exists`);
      continue;
    }

    console.log(`   📦 Creating collection: ${def.name}`);
    try {
      await createCollection(
        def.id,
        def.name,
        def.permissions,
        false, // documentSecurity
        true   // enabled
      );
      console.log(`   ✅ Created: ${def.name}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("409") || msg.includes("already exists")) {
        console.log(`   ⏭️  Collection "${def.name}" already exists (race condition)`);
      } else {
        console.error(`   ❌ Failed to create "${def.name}": ${msg}`);
        throw error;
      }
    }
  }
}

export async function verifyCollections(): Promise<{ verified: string[]; missing: string[]; errors: string[] }> {
  const definitions = getAllCollectionDefinitions();
  const existingCollections = await listCollections();
  const existingIds = new Set(existingCollections.map((c) => c.$id));

  const verified: string[] = [];
  const missing: string[] = [];
  const errors: string[] = [];

  for (const def of definitions) {
    if (existingIds.has(def.id)) {
      try {
        const col = await getCollection(def.id);
        if (col) {
          verified.push(def.id);
        } else {
          missing.push(def.id);
        }
      } catch {
        errors.push(def.id);
      }
    } else {
      missing.push(def.id);
    }
  }

  return { verified, missing, errors };
}