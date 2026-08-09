import { NextRequest, NextResponse } from "next/server";
import { checkAndAwardBadges } from "@/lib/badges/definitions";
import { computeImpactScore } from "@/lib/social/impact";
import { AppProfile, UserStats } from "@/lib/social/types";
import { normalizeBadge, normalizeProfile } from "@/lib/social/utils";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers";

const COLLECTIONS = {
  profiles: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES || "profiles",
  posts: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_POSTS || "posts",
  comments: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_COMMENTS || "comments",
  follows: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_FOLLOWS || "follows",
  projects: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROJECTS || "projects",
  tasks: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASKS || "tasks",
  badges: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_BADGES || "badges",
  events: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_EVENTS || "events",
  eventRsvps: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_EVENT_RSVPS || "event-rsvps",
  documents: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_DOCUMENTS || "documents",
  slideshows: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_SLIDESHOWS || "slideshows",
};

async function appwriteJson(path: string, init?: RequestInit) {
  const response = await fetch(`${endpoint}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": projectId || "",
      "X-Appwrite-Key": apiKey || "",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Appwrite API error: ${response.status} ${body}`);
  }

  return response.json();
}

async function list(collectionId: string, queries: string[]) {
  const url =
    `${endpoint}/databases/${databaseId}/collections/${collectionId}/documents` +
    queries.map((query) => `&queries[]=${encodeURIComponent(query)}`).join("");
  return (await appwriteJson(url)) as { total: number; documents: Record<string, unknown>[] };
}

function countQuery(...queries: string[]) {
  return [...queries, JSON.stringify({ method: "limit", values: [1] })];
}

export async function POST(request: NextRequest) {
  if (!apiKey || !projectId) {
    return NextResponse.json({ error: "Appwrite not configured" }, { status: 500 });
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId query param required" }, { status: 400 });
  }

  // Only award badges for the signed-in user. Badges are computed from real
  // collection stats, so there is no privilege escalation — this guard just
  // stops third parties from triggering checks on someone else's behalf.
  const sessionResponse = await fetch(`${endpoint}/account`, {
    headers: {
      "X-Appwrite-Project": projectId,
      Cookie: request.headers.get("cookie") || "",
    },
  });
  if (!sessionResponse.ok) {
    return NextResponse.json({ error: "You must be signed in to check badges" }, { status: 401 });
  }
  const session = (await sessionResponse.json()) as { $id?: string };
  if (session.$id !== userId) {
    return NextResponse.json({ error: "You can only check badges for your own account" }, { status: 403 });
  }

  try {
    const [profileResult, postsResult, projectsResult, documentsCount, slideshowsCount, followingCount, followersCount, tasksDoneCount, eventsHostedCount, rsvpsGoingCount] = await Promise.all([
      fetch(`${endpoint}/databases/${databaseId}/collections/${COLLECTIONS.profiles}/documents/${userId}`, {
        headers: { "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey },
      }),
      list(COLLECTIONS.posts, [
        JSON.stringify({ method: "equal", attribute: "author_id", values: [userId] }),
        JSON.stringify({ method: "limit", values: [100] }),
      ]),
      list(COLLECTIONS.projects, [
        JSON.stringify({ method: "equal", attribute: "owner_id", values: [userId] }),
        JSON.stringify({ method: "limit", values: [100] }),
      ]),
      list(COLLECTIONS.documents, countQuery(JSON.stringify({ method: "equal", attribute: "user_id", values: [userId] }))),
      list(COLLECTIONS.slideshows, countQuery(JSON.stringify({ method: "equal", attribute: "user_id", values: [userId] }))),
      list(COLLECTIONS.follows, countQuery(JSON.stringify({ method: "equal", attribute: "follower_id", values: [userId] }))),
      list(COLLECTIONS.follows, countQuery(JSON.stringify({ method: "equal", attribute: "followee_id", values: [userId] }))),
      list(COLLECTIONS.tasks, countQuery(
        JSON.stringify({ method: "equal", attribute: "assignee_id", values: [userId] }),
        JSON.stringify({ method: "equal", attribute: "status", values: ["done"] }),
      )),
      list(COLLECTIONS.events, countQuery(JSON.stringify({ method: "equal", attribute: "host_id", values: [userId] }))),
      list(COLLECTIONS.eventRsvps, countQuery(
        JSON.stringify({ method: "equal", attribute: "user_id", values: [userId] }),
        JSON.stringify({ method: "equal", attribute: "status", values: ["going"] }),
      )),
    ]);

    const profileDoc = profileResult.ok ? ((await profileResult.json()) as Record<string, unknown>) : null;

    const postIds = postsResult.documents.map((post) => String(post.$id));
    let commentsReceived = 0;
    if (postIds.length > 0) {
      const comments = await list(COLLECTIONS.comments, [
        JSON.stringify({ method: "equal", attribute: "post_id", values: postIds }),
        JSON.stringify({ method: "limit", values: [1] }),
      ]);
      commentsReceived = comments.total;
    }

    const strandCounts: Partial<Record<"N" | "E" | "S" | "W", number>> = {};
    for (const doc of [...postsResult.documents, ...projectsResult.documents]) {
      const strand = doc.strand;
      if (strand === "N" || strand === "E" || strand === "S" || strand === "W") {
        strandCounts[strand] = (strandCounts[strand] || 0) + 1;
      }
    }

    const postsCount = postsResult.total;
    const projectsCount = projectsResult.total;
    const likesReceived = postsResult.documents.reduce(
      (sum, post) => sum + (Array.isArray(post.likes) ? post.likes.length : 0),
      0,
    );

    const createdMs =
      typeof profileDoc?.created_at_ms === "number" ? profileDoc.created_at_ms : Date.now();
    const daysSinceJoin = Math.max(0, Math.floor((Date.now() - createdMs) / 86_400_000));

    const stats: UserStats = {
      postsCount,
      projectsCount,
      documentsCount: documentsCount.total,
      slideshowsCount: slideshowsCount.total,
      followersCount: followersCount.total,
      followingCount: followingCount.total,
      likesReceived,
      commentsReceived,
      daysSinceJoin,
      // Streak tracking is not wired up yet; streak badges await a proper
      // activity-history engine.
      currentStreak: 0,
      longestStreak: 0,
      tasksCompleted: tasksDoneCount.total,
      eventsHosted: eventsHostedCount.total,
      eventsAttended: rsvpsGoingCount.total,
      impactScore: computeImpactScore({
        posts: postsCount,
        projects: projectsCount,
        documents: documentsCount.total,
        slideshows: slideshowsCount.total,
        eventsHosted: eventsHostedCount.total,
        roomsJoined: 0,
        followers: followersCount.total,
      }),
      strandCounts,
    };

    const profile: AppProfile = profileDoc
      ? normalizeProfile(userId, profileDoc)
      : normalizeProfile(userId, {});

    const newlyAwarded = await checkAndAwardBadges(
      userId,
      profile,
      stats,
      async () => {
        const existing = await list(COLLECTIONS.badges, [
          JSON.stringify({ method: "equal", attribute: "user_id", values: [userId] }),
          JSON.stringify({ method: "limit", values: [100] }),
        ]);
        return existing.documents.map((doc) => normalizeBadge(String(doc.$id), doc));
      },
      async (badge) => {
        const created = await appwriteJson(
          `/databases/${databaseId}/collections/${COLLECTIONS.badges}/documents`,
          {
            method: "POST",
            body: JSON.stringify({
              data: {
                user_id: badge.user_id,
                badge_id: badge.badge_id,
                badge_name: badge.badge_name,
                badge_description: badge.badge_description,
                badge_icon: badge.badge_icon,
                badge_category: badge.badge_category,
                earned_at_ms: Date.now(),
                metadata: JSON.stringify(badge.metadata || {}),
              },
              permissions: [
                `read("user:${userId}")`,
                `update("user:${userId}")`,
                `delete("user:${userId}")`,
              ],
            }),
          },
        );
        return normalizeBadge(String(created.$id), created);
      },
    );

    return NextResponse.json({
      userId,
      stats,
      newlyAwarded,
      totalEarned: newlyAwarded.length,
    });
  } catch (error) {
    console.error("Badge check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
