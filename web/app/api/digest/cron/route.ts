import { NextRequest, NextResponse } from "next/server";
import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";
import { buildAndSendDigest } from "@/lib/digest/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled digest sender, wired to `vercel.json`'s daily cron. Protected by
 * the server API key (Authorization: Bearer APPWRITE_API_KEY), so only callers
 * that know the server secret can trigger it. Sends every profile that has
 * `email_notifications: true` their personal digest; per-user failures are
 * isolated and reported in the summary.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.APPWRITE_API_KEY?.trim();
  const provided = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!appwriteEnabled) {
    return NextResponse.json({ error: "Appwrite is not configured." }, { status: 500 });
  }

  const apiKey = expected;
  const profilesCollection = appwriteConfig.collections.profiles;

  const listUrl = `${appwriteConfig.endpoint}/databases/${appwriteConfig.databaseId}/collections/${profilesCollection}/documents?queries[]=${encodeURIComponent('equal("email_notifications", true)')}&queries[]=${encodeURIComponent("limit(200)")}`;

  const listResponse = await fetch(listUrl, {
    headers: {
      "X-Appwrite-Project": appwriteConfig.projectId,
      "X-Appwrite-Key": apiKey,
    },
  });
  if (!listResponse.ok) {
    return NextResponse.json(
      { error: `Could not list profiles (${listResponse.status}).` },
      { status: 502 },
    );
  }

  const payload = (await listResponse.json()) as {
    documents?: Array<Record<string, unknown>>;
  };
  const profiles = payload.documents ?? [];

  const results: Array<{ userId: string; sent: boolean; reason?: string }> = [];
  for (const profile of profiles) {
    const userId = String(profile.$id);
    try {
      const accountResponse = await fetch(
        `${appwriteConfig.endpoint}/users/${encodeURIComponent(userId)}`,
        {
          headers: {
            "X-Appwrite-Project": appwriteConfig.projectId,
            "X-Appwrite-Key": apiKey,
          },
        },
      );
      if (!accountResponse.ok) {
        results.push({ userId, sent: false, reason: `account lookup failed (${accountResponse.status})` });
        continue;
      }
      const account = (await accountResponse.json()) as { email?: string; name?: string };
      if (!account.email) {
        results.push({ userId, sent: false, reason: "no email on account" });
        continue;
      }
      const outcome = await buildAndSendDigest(userId, {
        name: account.name || "Changemaker",
        email: account.email,
      });
      results.push({ userId, sent: outcome.sent, reason: outcome.reason });
    } catch (error) {
      results.push({
        userId,
        sent: false,
        reason: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const sent = results.filter((result) => result.sent).length;
  return NextResponse.json({
    ok: true,
    attempted: results.length,
    sent,
    failed: results.length - sent,
    results,
  });
}
