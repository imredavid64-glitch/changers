import { ensureAllCollectionAttributes, fixEnumAttributes, fixJsonAttributes, addSearchIndexAttributes } from "../schema/attributes";
import type { MigrationResult } from "../types";

export async function runFixAttributes(): Promise<MigrationResult> {
  console.log("🔧 Running fix-attributes equivalent...\n");

  try {
    // 1. Ensure all base attributes
    console.log("📝 Step 1: Ensuring all base attributes...");
    await ensureAllCollectionAttributes();

    // 2. Fix enum attributes
    console.log("\n📝 Step 2: Fixing enum attributes...");
    await fixEnumAttributes();

    // 3. Fix JSON attributes
    console.log("\n📝 Step 3: Fixing JSON attributes...");
    await fixJsonAttributes();

    // 4. Add search_index attributes
    console.log("\n📝 Step 4: Adding search_index attributes...");
    await addSearchIndexAttributes();

    return { success: true, message: "All attribute fixes completed" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Fix attributes failed: ${msg}` };
  }
}