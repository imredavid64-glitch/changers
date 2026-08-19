import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sharp", () => ({ default: {} }));
vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockRejectedValue(new Error("no database")),
    end: vi.fn(),
  })),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function routeFetch(handlers: Record<string, { body: unknown; status?: number }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const match = Object.keys(handlers).find((key) => url.endsWith(key));
      if (!match) {
        return jsonResponse({ message: "Not found" }, 404);
      }
      const { body, status } = handlers[match];
      return jsonResponse(body, status);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runPlatformHealthChecks", () => {
  it("reports a fully healthy platform", async () => {
    routeFetch({
      "/health/version": { body: { version: "1.9.6" } },
      "/health/storage/local": { body: {} },
      "/databases/test-db": { body: {} },
      "/databases/test-db/collections": {
        body: { collections: [
          { $id: "profiles" }, { $id: "posts" }, { $id: "comments" }, { $id: "notifications" },
          { $id: "follows" }, { $id: "saved-posts" }, { $id: "rooms" }, { $id: "room-messages" },
          { $id: "threads" }, { $id: "thread-messages" }, { $id: "blocks" }, { $id: "projects" },
          { $id: "tasks" }, { $id: "badges" }, { $id: "events" }, { $id: "event-rsvps" },
          { $id: "documents" }, { $id: "slideshows" }, { $id: "tables" }, { $id: "code-snippets" },
          { $id: "designs" }, { $id: "films" }, { $id: "call-signals" },
        ] },
      },
      "/attributes": { body: { attributes: [{ key: "full_name", status: "available" }] } },
      "/storage/buckets/changers-media": { body: { maximumFileSize: 50_000_000 } },
    });

    const { runPlatformHealthChecks } = await import("@/lib/appwrite/health");
    const report = await runPlatformHealthChecks();
    expect(report.ok).toBe(true);
    const statuses = report.checks.map((c) => c.status);
    expect(statuses.every((s) => s === "ok")).toBe(true);
  });

  it("flags a missing database (the failure mode seen in production)", async () => {
    routeFetch({
      "/health/version": { body: { version: "1.9.6" } },
      "/health/storage/local": { body: {} },
      "/databases/test-db": { body: { message: "Database not found" }, status: 404 },
    });

    const { runPlatformHealthChecks } = await import("@/lib/appwrite/health");
    const report = await runPlatformHealthChecks();
    expect(report.ok).toBe(false);
    const database = report.checks.find((c) => c.key === "database");
    expect(database?.status).toBe("fail");
    expect(database?.detail).toContain("not found");
  });

  it("flags a failed attribute (schema capacity overflow)", async () => {
    routeFetch({
      "/health/version": { body: { version: "1.9.6" } },
      "/health/storage/local": { body: {} },
      "/databases/test-db/collections": {
        body: { collections: [{ $id: "profiles" }, { $id: "posts" }] },
      },
      "/attributes": {
        body: { attributes: [
          { key: "full_name", status: "available" },
          { key: "search_index", status: "failed" },
        ] },
      },
      "/storage/buckets/changers-media": { body: { maximumFileSize: 50_000_000 } },
    });

    const { runPlatformHealthChecks } = await import("@/lib/appwrite/health");
    const report = await runPlatformHealthChecks();
    expect(report.ok).toBe(false);
    const schema = report.checks.find((c) => c.key === "schema");
    expect(schema?.status).toBe("fail");
    expect(schema?.detail).toContain("search_index");
  });

  it("flags a missing media bucket", async () => {
    routeFetch({
      "/health/version": { body: { version: "1.9.6" } },
      "/health/storage/local": { body: {} },
      "/databases/test-db": { body: {} },
      "/databases/test-db/collections": { body: { collections: [] } },
    });

    const { runPlatformHealthChecks } = await import("@/lib/appwrite/health");
    const report = await runPlatformHealthChecks();
    expect(report.ok).toBe(false);
    const bucket = report.checks.find((c) => c.key === "media-bucket");
    expect(bucket?.status).toBe("fail");
  });

  it("reports an unreachable endpoint as a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }),
    );

    const { runPlatformHealthChecks } = await import("@/lib/appwrite/health");
    const report = await runPlatformHealthChecks();
    expect(report.ok).toBe(false);
    const endpoint = report.checks.find((c) => c.key === "endpoint");
    expect(endpoint?.status).toBe("fail");
  });
});