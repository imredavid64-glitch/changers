import { describe, it, expect } from "vitest";
import { 
  formatHealthReportMarkdown, 
  formatHealthReportSummary, 
  getFailedChecks, 
  getWarningChecks,
  isAutoFixable 
} from "./health/report";
import { categorizeChecks } from "./health/extended";
import type { PlatformHealthReport } from "./types";

const mockHealthReport: PlatformHealthReport = {
  ok: false,
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "test-project",
  databaseId: "changers",
  checkedAt: new Date().toISOString(),
  checks: [
    { key: "endpoint", label: "Appwrite reachable", status: "ok", detail: "OK" },
    { key: "database", label: "Database exists", status: "ok", detail: "OK" },
    { key: "collections", label: "Collections", status: "fail", detail: "Missing 2 collections" },
    { key: "schema", label: "Schema capacity", status: "fail", detail: "3 attributes failed" },
    { key: "media-bucket", label: "Media bucket", status: "warn", detail: "Bucket check timed out" },
    { key: "attr-limit-profiles", label: "Attribute limit: Profiles", status: "fail", detail: "At limit" },
    { key: "index-status-rooms", label: "Index status: Rooms", status: "warn", detail: "1 index processing" },
    { key: "postgres", label: "PostgreSQL connection", status: "ok", detail: "Connected" },
  ],
};

describe("db-agent health report", () => {
  it("formats markdown report correctly", () => {
    const markdown = formatHealthReportMarkdown(mockHealthReport);
    expect(markdown).toContain("⚠️ ISSUES DETECTED");
    expect(markdown).toContain("Failed Checks (3)");
    expect(markdown).toContain("Warnings (2)");
    expect(markdown).toContain("Passing Checks (3)");
  });

  it("formats summary correctly", () => {
    const summary = formatHealthReportSummary(mockHealthReport);
    expect(summary).toContain("❌");
    expect(summary).toContain("3 ok");
    expect(summary).toContain("2 warn");
    expect(summary).toContain("3 fail");
  });

  it("gets failed checks", () => {
    const failed = getFailedChecks(mockHealthReport);
    expect(failed).toHaveLength(3);
    expect(failed.map(f => f.key)).toEqual(["collections", "schema", "attr-limit-profiles"]);
  });

  it("gets warning checks", () => {
    const warnings = getWarningChecks(mockHealthReport);
    expect(warnings).toHaveLength(2);
    expect(warnings.map(w => w.key)).toEqual(["media-bucket", "index-status-rooms"]);
  });

  it("identifies auto-fixable checks", () => {
    expect(isAutoFixable({ key: "collections", label: "", status: "fail", detail: "" })).toBe(true);
    expect(isAutoFixable({ key: "schema", label: "", status: "fail", detail: "" })).toBe(true);
    expect(isAutoFixable({ key: "media-bucket", label: "", status: "fail", detail: "" })).toBe(true);
    expect(isAutoFixable({ key: "attr-limit-profiles", label: "", status: "fail", detail: "" })).toBe(true);
    expect(isAutoFixable({ key: "index-status-rooms", label: "", status: "fail", detail: "" })).toBe(true);
    expect(isAutoFixable({ key: "endpoint", label: "", status: "fail", detail: "" })).toBe(false);
    expect(isAutoFixable({ key: "database", label: "", status: "fail", detail: "" })).toBe(false);
  });
});

describe("categorizeChecks", () => {
  it("categorizes checks correctly", () => {
    const { critical, warnings, ok, autoFixable, requiresApproval } = categorizeChecks(mockHealthReport);
    
    expect(critical).toHaveLength(1); // collections (endpoint, database are ok)
    expect(warnings).toHaveLength(2); // media-bucket, index-status-rooms
    expect(ok).toHaveLength(3); // endpoint, database, postgres
    expect(autoFixable).toHaveLength(3); // collections, schema, attr-limit-profiles (index-status-rooms is warn not fail)
    expect(requiresApproval).toHaveLength(0); // no non-auto-fixable failures in this mock
  });
});

describe("db-agent config", () => {
  it("has correct model configuration", async () => {
    const { dbAgentConfig } = await import("./config");
    expect(dbAgentConfig.models.read.provider).toBe("openrouter");
    expect(dbAgentConfig.models.read.model).toBe("qwen/qwen-2.5-72b-instruct:free");
    expect(dbAgentConfig.models.write.provider).toBe("ollama");
    expect(dbAgentConfig.models.write.model).toBe("qwen2.5:72b");
  });

  it("has correct limits configuration", async () => {
    const { dbAgentConfig } = await import("./config");
    expect(dbAgentConfig.limits.maxAttributesPerCollection).toBe(100);
    expect(dbAgentConfig.limits.attributeLimitWarningThreshold).toBe(85);
  });
});

describe("db-agent client", () => {
  it("exports all required functions", async () => {
    const client = await import("./client");
    expect(client.listCollections).toBeDefined();
    expect(client.getCollection).toBeDefined();
    expect(client.createCollection).toBeDefined();
    expect(client.deleteCollection).toBeDefined();
    expect(client.listAttributes).toBeDefined();
    expect(client.createStringAttribute).toBeDefined();
    expect(client.createIntegerAttribute).toBeDefined();
    expect(client.createBooleanAttribute).toBeDefined();
    expect(client.createJsonAttribute).toBeDefined();
    expect(client.deleteAttribute).toBeDefined();
    expect(client.waitForAttribute).toBeDefined();
    expect(client.listIndexes).toBeDefined();
    expect(client.createIndex).toBeDefined();
    expect(client.deleteIndex).toBeDefined();
    expect(client.getBucket).toBeDefined();
    expect(client.createBucket).toBeDefined();
    expect(client.getAttributeLimitStatus).toBeDefined();
    expect(client.checkHealth).toBeDefined();
  });
});