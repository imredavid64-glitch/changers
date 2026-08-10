import { describe, expect, it } from "vitest";
import { composeDigestEmail, type DigestData } from "./compose";

function sampleData(overrides: Partial<DigestData> = {}): DigestData {
  return {
    name: "Ada",
    messages: [
      {
        threadId: "t1",
        senderName: "Lin",
        text: "Can you review the project plan?",
        atMs: 1_700_000_000_000,
      },
    ],
    trendingPosts: [
      { postId: "p1", title: "Cleanup drive", authorName: "Grace", likes: 12, atMs: 1_700_000_000_000 },
    ],
    ...overrides,
  };
}

describe("composeDigestEmail", () => {
  it("subjects with the unread count when there are messages", () => {
    const composed = composeDigestEmail(sampleData());
    expect(composed.subject).toBe("Your Changers digest — 1 new message");
  });

  it("uses a plural subject for multiple messages", () => {
    const data = sampleData({
      messages: [
        { threadId: "t1", senderName: "A", text: "x", atMs: 1 },
        { threadId: "t2", senderName: "B", text: "y", atMs: 2 },
      ],
    });
    expect(composeDigestEmail(data).subject).toBe("Your Changers digest — 2 new messages");
  });

  it("falls back to a what's-new subject when only posts exist", () => {
    const data = sampleData({ messages: [] });
    expect(composeDigestEmail(data).subject).toBe("Your Changers digest — what's new");
  });

  it("handles the empty digest gracefully", () => {
    const data = sampleData({ messages: [], trendingPosts: [] });
    const composed = composeDigestEmail(data);
    expect(composed.text).toContain("no new messages or posts");
    expect(composed.text).toContain("Hi Ada,");
  });

  it("lists senders and post titles in the body", () => {
    const composed = composeDigestEmail(sampleData());
    expect(composed.text).toContain("Lin: Can you review the project plan?");
    expect(composed.text).toContain("Cleanup drive by Grace (12 likes)");
    expect(composed.html).toContain("<strong>Lin</strong>");
  });

  it("escapes HTML in user content", () => {
    const data = sampleData({
      messages: [
        { threadId: "t1", senderName: "<script>", text: "<b>bold</b> & more", atMs: 1 },
      ],
      trendingPosts: [
        { postId: "p1", title: "Title \"quoted\"", authorName: "O'Neil", likes: 0, atMs: 2 },
      ],
    });
    const composed = composeDigestEmail(data);
    expect(composed.html).toContain("&lt;script&gt;");
    expect(composed.html).not.toContain("<script>");
    expect(composed.html).toContain("&quot;quoted&quot;");
    expect(composed.html).toContain("O&#39;Neil");
  });

  it("truncates long snippets with an ellipsis", () => {
    const longText = "word ".repeat(60).trim();
    const composed = composeDigestEmail(sampleData({ messages: [{ threadId: "t1", senderName: "Lin", text: longText, atMs: 1 }] }));
    expect(composed.text).toContain("…");
    expect(composed.text.length).toBeLessThan(400);
  });

  it("caps lists at five items", () => {
    const messages = Array.from({ length: 9 }, (_, index) => ({
      threadId: `t${index}`,
      senderName: `S${index}`,
      text: `message ${index}`,
      atMs: index,
    }));
    const trendingPosts = Array.from({ length: 8 }, (_, index) => ({
      postId: `p${index}`,
      title: `Post ${index}`,
      authorName: "A",
      likes: 0,
      atMs: index,
    }));
    const composed = composeDigestEmail(sampleData({ messages, trendingPosts }));
    expect(composed.text.match(/• /g)?.length).toBe(10); // 5 messages + 5 posts
  });
});
