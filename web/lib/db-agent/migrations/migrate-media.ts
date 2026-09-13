import { dbAgentConfig } from "../config";
import type { MigrationResult } from "../types";

export async function runMigrateMedia(): Promise<MigrationResult> {
  console.log("📁 Running media migration...");

  const pgUrl = dbAgentConfig.postgres.url;
  if (!pgUrl) {
    return { success: false, message: "DATABASE_URL not configured. Skipping media migration." };
  }

  try {
    // Note: The existing script is a standalone CLI tool
    // We'll need to adapt it or call it as a subprocess
    console.log("⚠️  Media migration requires running the standalone script:");
    console.log("   node changers/scripts/migrate-media.mjs");
    
    return { 
      success: true, 
      message: "Media migration script available at changers/scripts/migrate-media.mjs. Run manually with: node changers/scripts/migrate-media.mjs" 
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Media migration check failed: ${msg}` };
  }
}

export async function checkMigrationStatus(): Promise<MigrationResult> {
  const pgUrl = dbAgentConfig.postgres.url;
  if (!pgUrl) {
    return { success: false, message: "PostgreSQL not configured" };
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: pgUrl, max: 1 });
    
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM media_assets
    `);
    
    await pool.end();
    
    return { 
      success: true, 
      message: `PostgreSQL media_assets table has ${result.rows[0].count} records`,
      details: { recordCount: parseInt(result.rows[0].count) }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Migration status check failed: ${msg}` };
  }
}