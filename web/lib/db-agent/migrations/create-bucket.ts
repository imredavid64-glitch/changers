import { ensureMediaBucket } from "../storage/buckets";
import type { MigrationResult } from "../types";

export async function runCreateBucket(): Promise<MigrationResult> {
  console.log("📦 Running create-bucket equivalent...");

  try {
    const bucket = await ensureMediaBucket();
    if (bucket) {
      return { success: true, message: `Bucket "${bucket.$id}" ready` };
    }
    return { success: false, message: "Bucket creation failed" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Create bucket failed: ${msg}` };
  }
}