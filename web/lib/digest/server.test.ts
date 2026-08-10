import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { $id: string; [key: string]: unknown };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function applyQueries(docs: Doc[], url: string): Doc[] {
  const queries = new URL(url).searchParams.getAll("queries[]");
  let filtered = docs;
  for (const query of queries) {
    const equal = query.match(/^equal\("([^"]+)","([^"]+)"\)$/);
    if (equal) {
      const field = equal[1];
      const value = equal[2];
      filtered = filtered.filter((doc) => {
        const cell = doc[field];
        return Array.isArray(cell) ? cell.includes(value) : String(cell) === value;
      });
      continue;
    }
    const order = query.match(/^orderDesc\("([^"]+)"\)$/);
    if (order) {
      const field = order[1];
      filtered = [...filtered].sort(
        (a, b) => Number(b[field] ?? 0) - Number(a[field] ?? 0),
      );
    }
  }
  return filtered;
}

const calls: string[] = [];

function installFetchMock(docsByCollection: Record<string, Doc[]>) {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push(url);
      const path = new URL(url).pathname;
      const match = path.match(/\/collections\/([^/]+)\/documents/);
      if (!match) return jsonResponse({ error: "unexpected request" }, 404);
      const collectionId = decodeURIComponent(match[1]);
      return jsonResponse({ documents: applyQueries(docsByCollection[collectionId] || [], url) });
    }),
  );
}

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

describe("fetchDigestData", () => {
  let fetchDigestData: typeof import("./server").fetchDigestData;

  beforeEach(async () => {
    vi.resetModules();
    fetchDigestData = (await import("./server")).fetchDigestData;
  });

  it("collects recent messages from other people in my threads", async () => {
    installFetchMock({
      threads: [{ $id: "t1", participants: ["me", "them"] }],
      "thread-messages": [
        { $id: "m1", thread_id: "t1", sender_id: "them", sender_name: "Lin", text: "hi!", created_at_ms: now - DAY },
        { $id: "m2", thread_id: "t1", sender_id: "me", sender_name: "Me", text: "my own", created_at_ms: now - DAY },
        { $id: "m3", thread_id: "t1", sender_id: "them", sender_name: "Lin", text: "old", created_at_ms: now - 10 * DAY },
      ],
      posts: [],
    });

    const result = await fetchDigestData("me");
    expect(result.messages.map((m) => m.text)).toEqual(["hi!"]);
    // Own messages excluded, out-of-window excluded.
    expect(result.messages.length).toBe(1);
  });

  it("queries only threads the user participates in", async () => {
    installFetchMock({
      threads: [{ $id: "t1", participants: ["me", "a"] }],
      "thread-messages": [],
      posts: [],
    });
    await fetchDigestData("me");
    expect(
      calls.some((url) =>
        new URL(url)
          .searchParams.getAll("queries[]")
          .includes('equal("participants", "me")'),
      ),
    ).toBe(true);
  });

  it("collects recent posts and derives like counts from liked_by", async () => {
    installFetchMock({
      threads: [],
      "thread-messages": [],
      posts: [
        { $id: "p1", title: "Drive", author_name: "Grace", liked_by: ["u1", "u2"], created_at_ms: now - DAY },
        { $id: "p2", title: "Old", author_name: "Ada", liked_by: [], created_at_ms: now - 10 * DAY },
      ],
    });

    const result = await fetchDigestData("me");
    expect(result.trendingPosts).toHaveLength(1);
    expect(result.trendingPosts[0].postId).toBe("p1");
    expect(result.trendingPosts[0].likes).toBe(2);
  });
});

describe("sendDigestEmail / buildAndSendDigest", () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it("is inert (not sent) when SMTP is not configured", async () => {
    // The vitest env has no SMTP_* vars, so getSmtpConfig returns null.
    const { sendDigestEmail } = await import("./server");
    const result = await sendDigestEmail(
      { name: "Ada", email: "ada@example.com" },
      { name: "Ada", messages: [], trendingPosts: [] },
    );
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("SMTP is not configured");
  });

  it("buildAndSendDigest returns ingredient counts even when not sent", async () => {
    installFetchMock({
      threads: [{ $id: "t1", participants: ["me", "them"] }],
      "thread-messages": [
        { $id: "m1", thread_id: "t1", sender_id: "them", sender_name: "Lin", text: "hello", created_at_ms: now - DAY },
      ],
      posts: [{ $id: "p1", title: "Post", author_name: "A", created_at_ms: now - DAY }],
    });
    const { buildAndSendDigest } = await import("./server");
    const result = await buildAndSendDigest("me", { name: "Me", email: "me@example.com" });
    expect(result.messages).toBe(1);
    expect(result.posts).toBe(1);
    expect(result.sent).toBe(false);
  });
});
