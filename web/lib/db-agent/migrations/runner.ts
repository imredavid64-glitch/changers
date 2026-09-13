import { ensureMediaBucket } from "../storage/buckets";
import { ensureAllCollectionAttributes, fixEnumAttributes, fixJsonAttributes, addSearchIndexAttributes } from "../schema/attributes";
import { ensureRequiredIndexes } from "../schema/indexes";
import { runExtendedHealthChecks } from "../health/extended";
import type { MigrationResult } from "../types";

export interface MigrationStep {
  name: string;
  description: string;
  execute: () => Promise<MigrationResult>;
  rollback?: () => Promise<void>;
  autoFixable: boolean;
}

export async function runMigrations(steps: MigrationStep[]): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const step of steps) {
    console.log(`\n🔄 Running migration: ${step.name}`);
    console.log(`   ${step.description}`);
    
    try {
      const result = await step.execute();
      results.push(result);
      
      if (result.success) {
        console.log(`   ✅ ${step.name}: ${result.message}`);
      } else {
        console.error(`   ❌ ${step.name}: ${result.message}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ ${step.name}: ${msg}`);
      results.push({ success: false, message: msg });
    }
  }

  return results;
}

export async function runAutoFixMigrations(): Promise<MigrationResult[]> {
  const healthReport = await runExtendedHealthChecks();
  const { autoFixable } = categorizeChecks(healthReport);
  
  if (autoFixable.length === 0) {
    console.log("✅ No auto-fixable issues found");
    return [{ success: true, message: "No auto-fixable issues" }];
  }

  const steps: MigrationStep[] = [];

  // Check for missing collections
  const missingCollections = autoFixable.filter((c) => c.key === "collections");
  if (missingCollections.length > 0) {
    steps.push({
      name: "create-missing-collections",
      description: "Create missing collections from definitions",
      autoFixable: true,
      execute: async () => {
        const { ensureAllCollections } = await import("./create-collections");
        await ensureAllCollections();
        return { success: true, message: "Missing collections created" };
      },
    });
  }

  // Check for missing attributes (schema)
  const schemaIssues = autoFixable.filter((c) => c.key === "schema");
  if (schemaIssues.length > 0) {
    steps.push({
      name: "fix-schema-attributes",
      description: "Fix failed/processing attributes",
      autoFixable: true,
      execute: async () => {
        await ensureAllCollectionAttributes();
        return { success: true, message: "Schema attributes fixed" };
      },
    });
  }

  // Check for missing media bucket
  const bucketIssues = autoFixable.filter((c) => c.key === "media-bucket");
  if (bucketIssues.length > 0) {
    steps.push({
      name: "create-media-bucket",
      description: "Create missing media bucket",
      autoFixable: true,
      execute: async () => {
        await ensureMediaBucket();
        return { success: true, message: "Media bucket created" };
      },
    });
  }

  // Check for attribute limits (need manual intervention)
  const attrLimitIssues = autoFixable.filter((c) => c.key.startsWith("attr-limit-"));
  if (attrLimitIssues.length > 0) {
    console.log(`⚠️  ${attrLimitIssues.length} collection(s) at attribute limit - requires manual intervention`);
  }

  // Check for index status
  const indexIssues = autoFixable.filter((c) => c.key.startsWith("index-status-"));
  if (indexIssues.length > 0) {
    steps.push({
      name: "ensure-required-indexes",
      description: "Create missing required indexes",
      autoFixable: true,
      execute: async () => {
        await ensureRequiredIndexes();
        return { success: true, message: "Required indexes created" };
      },
    });
  }

  return runMigrations(steps);
}

export async function runFullSetup(): Promise<MigrationResult[]> {
  const steps: MigrationStep[] = [
    {
      name: "health-check",
      description: "Run initial health check",
      autoFixable: true,
      execute: async () => {
        const report = await runExtendedHealthChecks();
        return { success: report.ok, message: report.ok ? "Health check passed" : "Health check found issues" };
      },
    },
    {
      name: "create-collections",
      description: "Create all 25 collections",
      autoFixable: true,
      execute: async () => {
        const { ensureAllCollections } = await import("./create-collections");
        await ensureAllCollections();
        return { success: true, message: "All collections created/verified" };
      },
    },
    {
      name: "create-attributes",
      description: "Create all attributes for all collections",
      autoFixable: true,
      execute: async () => {
        await ensureAllCollectionAttributes();
        return { success: true, message: "All attributes created/verified" };
      },
    },
    {
      name: "fix-enum-attributes",
      description: "Add enum validation attributes",
      autoFixable: true,
      execute: async () => {
        await fixEnumAttributes();
        return { success: true, message: "Enum attributes processed" };
      },
    },
    {
      name: "fix-json-attributes",
      description: "Add JSON attributes where possible",
      autoFixable: true,
      execute: async () => {
        await fixJsonAttributes();
        return { success: true, message: "JSON attributes processed" };
      },
    },
    {
      name: "add-search-indexes",
      description: "Add search_index attributes for fulltext search",
      autoFixable: true,
      execute: async () => {
        await addSearchIndexAttributes();
        return { success: true, message: "Search index attributes processed" };
      },
    },
    {
      name: "create-indexes",
      description: "Create all required indexes",
      autoFixable: true,
      execute: async () => {
        await ensureRequiredIndexes();
        return { success: true, message: "All indexes created/verified" };
      },
    },
    {
      name: "create-media-bucket",
      description: "Create media storage bucket",
      autoFixable: true,
      execute: async () => {
        await ensureMediaBucket();
        return { success: true, message: "Media bucket created/verified" };
      },
    },
    {
      name: "final-health-check",
      description: "Run final health check",
      autoFixable: true,
      execute: async () => {
        const report = await runExtendedHealthChecks();
        return { success: report.ok, message: report.ok ? "All systems healthy" : "Some issues remain" };
      },
    },
  ];

  return runMigrations(steps);
}

function categorizeChecks(report: { checks: Array<{ key: string; status: string }> }) {
  const autoFixable = report.checks.filter((c) => c.status === "fail" && isAutoFixable(c.key));
  return { autoFixable };
}

function isAutoFixable(key: string): boolean {
  const autoFixablePrefixes = [
    "collections",
    "schema",
    "media-bucket",
    "attr-limit-",
    "index-status-",
  ];
  return autoFixablePrefixes.some((prefix) => key.startsWith(prefix));
}