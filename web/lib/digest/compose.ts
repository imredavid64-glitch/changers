/**
 * Pure digest composition — no I/O, fully unit-testable. The route fetches the
 * data (messages + trending posts) and this module turns it into an email.
 */

export interface DigestMessageItem {
  threadId: string;
  senderName: string;
  text: string;
  atMs: number;
}

export interface DigestPostItem {
  postId: string;
  title: string;
  authorName: string;
  likes: number;
  atMs: number;
}

export interface DigestData {
  /** Recipient's display name. */
  name: string;
  /** Messages from other people in the last digest window. */
  messages: DigestMessageItem[];
  /** Posts to surface from the last digest window. */
  trendingPosts: DigestPostItem[];
}

export interface ComposedDigest {
  subject: string;
  text: string;
  html: string;
}

const WINDOW_LABEL = "the last 7 days";

export function composeDigestEmail(data: DigestData): ComposedDigest {
  const { name, messages, trendingPosts } = data;
  const unread = messages.length;
  const postCount = trendingPosts.length;

  const subject = unread > 0
    ? `Your Changers digest — ${unread} new message${unread > 1 ? "s" : ""}`
    : postCount > 0
      ? "Your Changers digest — what's new"
      : "Your Changers digest — nothing new yet";

  const greeting = `Hi ${name || "changemaker"},`;

  const textLines: string[] = [greeting, ""];
  if (unread === 0 && postCount === 0) {
    textLines.push(`Here's your digest for ${WINDOW_LABEL} — no new messages or posts. Time to make some impact!`);
  } else {
    if (unread > 0) {
      textLines.push(`You have ${unread} new message${unread > 1 ? "s" : ""} waiting:`);
      textLines.push("");
      for (const message of messages.slice(0, 5)) {
        textLines.push(`  • ${message.senderName}: ${snippet(message.text)}`);
      }
      textLines.push("");
    }
    if (postCount > 0) {
      textLines.push(`Trending posts in ${WINDOW_LABEL}:`);
      textLines.push("");
      for (const post of trendingPosts.slice(0, 5)) {
        textLines.push(`  • ${post.title || "Untitled post"} by ${post.authorName}${post.likes > 0 ? ` (${post.likes} like${post.likes > 1 ? "s" : ""})` : ""}`);
      }
    }
  }
  textLines.push("");
  textLines.push("— The Changers team");
  textLines.push("");
  textLines.push("Open Changers: https://changers-three.vercel.app");

  const htmlParts: string[] = [
    `<h2 style="margin:0 0 8px;">Your Changers digest</h2>`,
    `<p>${escapeHtml(greeting)}</p>`,
  ];

  if (unread > 0) {
    htmlParts.push(`<p><strong>${unread} new message${unread > 1 ? "s" : ""} in ${WINDOW_LABEL}:</strong></p><ul>`);
    for (const message of messages.slice(0, 5)) {
      htmlParts.push(
        `<li><strong>${escapeHtml(message.senderName)}</strong>: ${escapeHtml(snippet(message.text))}</li>`,
      );
    }
    htmlParts.push(`</ul>`);
  }

  if (postCount > 0) {
    htmlParts.push(`<p><strong>Trending posts in ${WINDOW_LABEL}:</strong></p><ul>`);
    for (const post of trendingPosts.slice(0, 5)) {
      htmlParts.push(
        `<li>${escapeHtml(post.title || "Untitled post")} by ${escapeHtml(post.authorName)}` +
          (post.likes > 0 ? ` <em>(${post.likes} like${post.likes > 1 ? "s" : ""})</em>` : "") +
          `</li>`,
      );
    }
    htmlParts.push(`</ul>`);
  }

  htmlParts.push(
    `<p>— The Changers team</p>`,
    `<p style="color:#666;font-size:0.85rem;"><a href="https://changers-three.vercel.app">Open Changers</a></p>`,
  );

  return {
    subject,
    text: textLines.join("\n"),
    html: htmlParts.join("\n"),
  };
}

function snippet(value: string, maxLength = 120) {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength - 1)}…`
    : collapsed;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
