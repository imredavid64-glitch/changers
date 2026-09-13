import { dbAgentConfig } from "../config";
import type { PlatformHealthReport, HealthCheck } from "../types";
import {
  checkEndpointReachable,
  checkStorageHealth,
  checkDatabaseExists,
  checkCollections,
  checkSchemaAttributes,
  checkMediaBucket,
  checkMediaDisk,
  checkAttributeLimits,
  checkIndexStatus,
  checkPostgresConnection,
} from "./checks";

export async function runExtendedHealthChecks(): Promise<PlatformHealthReport> {
  const baseChecks = await Promise.all([
    checkEndpointReachable(),
    checkStorageHealth(),
    checkDatabaseExists(),
    checkCollections(),
    checkSchemaAttributes(),
    checkMediaBucket(),
    checkMediaDisk(),
  ]);

  const [attrLimitChecks, indexStatusChecks, postgresCheck] = await Promise.all([
    checkAttributeLimits(),
    checkIndexStatus(),
    checkPostgresConnection(),
  ]);

  const allChecks: HealthCheck[] = [
    ...baseChecks,
    ...attrLimitChecks,
    ...indexStatusChecks,
    postgresCheck,
  ];

  return {
    ok: allChecks.every((check) => check.status === "ok"),
    endpoint: dbAgentConfig.appwrite.endpoint,
    projectId: dbAgentConfig.appwrite.projectId,
    databaseId: dbAgentConfig.appwrite.databaseId,
    checkedAt: new Date().toISOString(),
    checks: allChecks,
  };
}

export async function runQuickHealthCheck(): Promise<PlatformHealthReport> {
  const baseChecks = await Promise.all([
    checkEndpointReachable(),
    checkDatabaseExists(),
    checkCollections(),
    checkMediaBucket(),
  ]);

  return {
    ok: baseChecks.every((check) => check.status === "ok"),
    endpoint: dbAgentConfig.appwrite.endpoint,
    projectId: dbAgentConfig.appwrite.projectId,
    databaseId: dbAgentConfig.appwrite.databaseId,
    checkedAt: new Date().toISOString(),
    checks: baseChecks,
  };
}

export function categorizeChecks(report: PlatformHealthReport) {
  return {
    critical: report.checks.filter((c) => c.status === "fail" && isCritical(c.key)),
    warnings: report.checks.filter((c) => c.status === "warn"),
    ok: report.checks.filter((c) => c.status === "ok"),
    autoFixable: report.checks.filter((c) => c.status === "fail" && isAutoFixable(c.key)),
    requiresApproval: report.checks.filter((c) => c.status === "fail" && !isAutoFixable(c.key)),
  };
}

function isCritical(key: string): boolean {
  const criticalKeys = ["endpoint", "database", "collections"];
  return criticalKeys.some((k) => key.startsWith(k));
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