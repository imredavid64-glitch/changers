import nodemailer from "nodemailer";
import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";
import { getSmtpConfig } from "@/lib/contact/email";
import {
  composeDigestEmail,
  type DigestData,
  type DigestMessageItem,
  type DigestPostItem,
} from "./compose";

const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 10;
const MAX_POSTS = 10;
const MAX_THREADS = 10;

function getServerApiKey(): string | null {
  if (!appwriteEnabled) return null;
  return process.env.APPWRITE_API_KEY?.trim() || null;
}

function collectionUrl(collectionId: string) {
  return `/databases/${appwriteConfig.databaseId}/collections/${collectionId}/documents`;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    throw new Error("Appwrite API key is not configured on the server.");
  }

  const response = await fetch(`${appwriteConfig.endpoint}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": appwriteConfig.projectId,
      "X-Appwrite-Key": apiKey,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Appwrite API error: ${response.status} ${body.slice(0, 300)}`);
  }

  return (await response.json()) as { documents?: Array<Record<string, unknown>> };
}

function queryUrl(collectionId: string, queries: string[]) {
  const params = queries.map((query) => `queries[]=${encodeURIComponent(query)}`).join("&");
  return `${collectionUrl(collectionId)}?${params}`;
}

export interface DigestFetchResult {
  messages: DigestMessageItem[];
  trendingPosts: DigestPostItem[];
}

/**
 * Fetches the digest ingredients for a user: messages other people sent them
 * in the last 7 days across their threads, and recent posts from the same
 * window. Uses the server API key (bypasses client permissions).
 */
export async function fetchDigestData(userId: string): Promise<DigestFetchResult> {
  const cutoff = Date.now() - DIGEST_WINDOW_MS;

  // Threads the user participates in.
  const threadsPayload = await apiFetch(
    queryUrl(appwriteConfig.collections.threads, [
      `equal("participants", "${userId}")`,
      'orderDesc("updated_at_ms")',
      "limit(100)",
    ]),
  );
  const threadIds = (threadsPayload.documents ?? []).map((thread) => String(thread.$id));

  // Messages from other people in those threads, most recent first.
  const messages: DigestMessageItem[] = [];
  for (const threadId of threadIds.slice(0, MAX_THREADS)) {
    const messagesPayload = await apiFetch(
      queryUrl(appwriteConfig.collections.threadMessages, [
        `equal("thread_id", "${threadId}")`,
        'orderDesc("created_at_ms")',
        "limit(50)",
      ]),
    );
    for (const doc of messagesPayload.documents ?? []) {
      const atMs = Number(doc.created_at_ms ?? 0);
      if (atMs < cutoff) break; // ordered desc — first out-of-window doc ends the thread
      if (String(doc.sender_id) === userId) continue;
      messages.push({
        threadId,
        senderName: String(doc.sender_name ?? "Someone"),
        text: String(doc.text ?? ""),
        atMs,
      });
      if (messages.length >= MAX_MESSAGES) break;
    }
    if (messages.length >= MAX_MESSAGES) break;
  }

  // Recent posts to surface as "trending".
  const postsPayload = await apiFetch(
    queryUrl(appwriteConfig.collections.posts, [
      'orderDesc("created_at_ms")',
      "limit(50)",
    ]),
  );
  const trendingPosts: DigestPostItem[] = [];
  for (const doc of postsPayload.documents ?? []) {
    const atMs = Number(doc.created_at_ms ?? 0);
    if (atMs < cutoff) break;
    const likes = Array.isArray(doc.liked_by)
      ? doc.liked_by.length
      : Number(doc.likes ?? 0);
    trendingPosts.push({
      postId: String(doc.$id),
      title: String(doc.title ?? doc.body ?? ""),
      authorName: String(doc.author_name ?? "Someone"),
      likes: Number.isFinite(likes) ? likes : 0,
      atMs,
    });
    if (trendingPosts.length >= MAX_POSTS) break;
  }

  return { messages, trendingPosts };
}

/**
 * Sends a digest email over SMTP. Inert (returns `sent: false` with a reason)
 * until SMTP_HOST/USER/PASS + CONTACT_FORWARD_TO-style config is present — see
 * `getSmtpConfig` in lib/contact/email.ts.
 */
export async function sendDigestEmail(
  recipient: { name: string; email: string },
  data: DigestData,
): Promise<{ sent: boolean; reason?: string }> {
  const config = getSmtpConfig();
  if (!config) {
    return { sent: false, reason: "SMTP is not configured." };
  }

  const composed = composeDigestEmail(data);

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: config.from,
      to: recipient.email,
      subject: composed.subject,
      text: composed.text,
      html: composed.html,
    });

    return { sent: true };
  } catch (error) {
    console.error("Digest email failed:", error);
    return { sent: false, reason: error instanceof Error ? error.message : "Unknown SMTP error." };
  }
}

/** Fetch + compose + send in one step; returns counts for the response. */
export async function buildAndSendDigest(
  userId: string,
  recipient: { name: string; email: string },
): Promise<{ sent: boolean; reason?: string; messages: number; posts: number }> {
  const { messages, trendingPosts } = await fetchDigestData(userId);
  const result = await sendDigestEmail(recipient, {
    name: recipient.name,
    messages,
    trendingPosts,
  });
  return { ...result, messages: messages.length, posts: trendingPosts.length };
}
