import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock heavy native modules so vi.resetModules() doesn't re-transform them
// on every beforeEach. The pg Pool and sharp native addon are the main cost.
vi.mock("sharp", () => ({ default: {} }));
vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockRejectedValue(new Error("no database")),
    end: vi.fn(),
  })),
}));
vi.mock("appwrite", () => ({
  Client: vi.fn().mockImplementation(() => ({
    setEndpoint: vi.fn().mockReturnThis(),
    setProject: vi.fn().mockReturnThis(),
    setJWT: vi.fn().mockReturnThis(),
  })),
  Account: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockRejectedValue(new Error("not authenticated")),
  })),
}));

// The Appwrite fetch layer is mocked below; the modules under test run against
// canned document collections so the erase/anonymize flows can be asserted
// without a live backend. Postgres parts are intentionally skipped (no
// DATABASE_URL in the test env) and the code is designed to tolerate that.

type Doc = { $id: string; [key: string]: unknown };

interface FetchCall {
  method: string;
  url: string;
  body?: string;
}

const calls: FetchCall[] = [];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Applies the Appwrite `equal("field","value")` list queries from the URL to a
 * document set, mirroring how the real backend filters (array attributes match
 * when they contain the value).
 */
function applyQueries(docs: Doc[], url: string): Doc[] {
  const queries = new URL(url).searchParams.getAll("queries[]");
  let filtered = docs;
  for (const query of queries) {
    const match = query.match(/^equal\("([^"]+)","([^"]+)"\)$/);
    if (!match) continue;
    const field = match[1];
    const value = match[2];
    filtered = filtered.filter((doc) => {
      const cell = doc[field];
      return Array.isArray(cell) ? cell.includes(value) : cell === value;
    });
  }
  return filtered;
}

/**
 * Mocks global fetch so document list/get/delete/update and account deletion
 * resolve against canned per-collection documents, honoring equal() queries.
 */
function installFetchMock(docsByCollection: Record<string, Doc[]>) {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || "GET").toUpperCase();
      calls.push({
        method,
        url,
        body: typeof init?.body === "string" ? init.body : undefined,
      });

      const path = new URL(url).pathname;
      const match = path.match(/\/collections\/([^/]+)\/documents(?:\/([^/]+))?/);
      if (match) {
        const collectionId = decodeURIComponent(match[1]);
        const documentId = match[2];
        const docs = docsByCollection[collectionId] || [];

        if (method === "GET" && !documentId) {
          return jsonResponse({ documents: applyQueries(docs, url) });
        }
        if (method === "GET" && documentId) {
          const doc = docs.find((d) => d.$id === documentId);
          return jsonResponse(doc || {});
        }
        if (method === "DELETE" || method === "PATCH") {
          return jsonResponse({});
        }
      }

      if (path.includes("/users/") && method === "DELETE") {
        return jsonResponse({});
      }

      return jsonResponse({ error: "unexpected request" }, 404);
    }),
  );
}

function emptyCollections(): Record<string, Doc[]> {
  return {
    posts: [],
    comments: [],
    events: [],
    "event-rsvps": [],
    documents: [],
    slideshows: [],
    tables: [],
    "code-snippets": [],
    designs: [],
    films: [],
    badges: [],
    "saved-posts": [],
    notifications: [],
    "room-messages": [],
    "thread-messages": [],
    tasks: [],
    follows: [],
    blocks: [],
    rooms: [],
    projects: [],
    threads: [],
    profiles: [],
  };
}

function patchBodiesFor(collectionId: string): Array<{ data: Record<string, unknown> }> {
  return calls
    .filter((c) => c.method === "PATCH" && c.url.includes(`/collections/${collectionId}/`))
    .map((c) => JSON.parse(c.body || "{}") as { data: Record<string, unknown> });
}

function deleteCallCount(docPath: string) {
  // docPath is "collectionId/docId"; DELETE URLs end in /collections/<coll>/documents/<docId>.
  const documentId = docPath.split("/")[1];
  return calls.filter((c) => c.method === "DELETE" && c.url.includes(`/documents/${documentId}`)).length;
}

function expectDeleted(docPath: string) {
  expect(deleteCallCount(docPath)).toBeGreaterThan(0);
}

function expectNotDeleted(docPath: string) {
  expect(deleteCallCount(docPath)).toBe(0);
}

describe("deleteUserData (hard erase)", () => {
  let deleteUserData: typeof import("./server").deleteUserData;

  beforeEach(async () => {
    vi.resetModules();
    deleteUserData = (await import("./server")).deleteUserData;
  });

  it("deletes owned documents, owned rooms, and the account", async () => {
    const docs = emptyCollections();
    docs.posts = [{ $id: "post1", author_id: "u1" }];
    docs.comments = [{ $id: "c1", author_id: "u1" }];
    docs.rooms = [{ $id: "room1", owner_id: "u1", members: ["u1", "u2"] }];
    docs.projects = [{ $id: "proj1", owner_id: "u1", members: ["u1", "u2"] }];
    docs.profiles = [{ $id: "u1", full_name: "User One" }];
    installFetchMock(docs);

    const result = await deleteUserData("u1");

    // Owned docs hard-deleted.
    expectDeleted("posts/post1");
    expectDeleted("comments/c1");
    // Owned rooms and projects deleted (not just membership-removed).
    expectDeleted("rooms/room1");
    expectDeleted("projects/proj1");
    // Profile document + Appwrite account deleted.
    expectDeleted("profiles/u1");
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/users/u1"))).toBe(true);

    expect(result.deleted).toContain("posts/post1");
    expect(result.deleted).toContain("rooms/room1");
    expect(result.deleted).toContain("account/u1");
  });

  it("removes the user from shared memberships instead of deleting shared rooms", async () => {
    const docs = emptyCollections();
    docs.rooms = [{ $id: "room2", owner_id: "u2", members: ["u1", "u2"] }];
    installFetchMock(docs);

    await deleteUserData("u1");

    expectNotDeleted("rooms/room2");
    const patches = patchBodiesFor("rooms");
    expect(patches.length).toBe(1);
    expect(patches[0].data.members).toEqual(["u2"]);
  });
});

describe("anonymizeUserData", () => {
  let anonymizeUserData: typeof import("./server").anonymizeUserData;

  beforeEach(async () => {
    vi.resetModules();
    anonymizeUserData = (await import("./server")).anonymizeUserData;
  });

  it("deletes personal collections and keeps community content as 'Former member'", async () => {
    const docs = emptyCollections();
    docs.notifications = [{ $id: "n1", user_id: "u1" }];
    docs.posts = [{ $id: "post1", author_id: "u1", author_name: "User One" }];
    docs.comments = [{ $id: "c1", author_id: "u1", author_name: "User One" }];
    docs.rooms = [{ $id: "room1", owner_id: "u1", members: ["u1", "u2"] }];
    docs.profiles = [{ $id: "u1", full_name: "User One" }];
    installFetchMock(docs);

    const result = await anonymizeUserData("u1");

    // Personal collections deleted.
    expectDeleted("notifications/n1");

    // Community content anonymized, not deleted.
    expectNotDeleted("posts/post1");
    const postPatches = patchBodiesFor("posts");
    expect(postPatches.length).toBe(1);
    expect(postPatches[0].data.author_name).toBe("Former member");
    expect(postPatches[0].data.search_index).toBe("former member");

    const commentPatches = patchBodiesFor("comments");
    expect(commentPatches[0].data.author_name).toBe("Former member");

    // Owned room: owner name anonymized + user dropped from members.
    const roomPatches = patchBodiesFor("rooms");
    expect(roomPatches[0].data.owner_name).toBe("Former member");
    expect(roomPatches[0].data.members).toEqual(["u2"]);

    // Profile + account removed.
    expectDeleted("profiles/u1");
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/users/u1"))).toBe(true);

    expect(result.anonymized).toContain("posts/post1");
    expect(result.anonymized).toContain("comments/c1");
    expect(result.anonymized).toContain("rooms/room1");
    expect(result.deleted).toContain("notifications/n1");
    expect(result.deleted).toContain("account/u1");
  });

  it("removes the user from shared memberships in anonymize mode too", async () => {
    const docs = emptyCollections();
    docs.rooms = [{ $id: "room2", owner_id: "u2", members: ["u1", "u2"] }];
    installFetchMock(docs);

    await anonymizeUserData("u1");

    const patches = patchBodiesFor("rooms");
    expect(patches.length).toBe(1);
    expect(patches[0].data.members).toEqual(["u2"]);
  });
});
