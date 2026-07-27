import { AppPost, Strand } from "@/lib/social/types";
import { STRAND_LABELS, timestampToMillis } from "@/lib/social/utils";

export type FeedTab = "for-you" | "following" | "latest" | "trending";

export interface FeedContext {
  userId?: string;
  followingIds: string[];
  preferredStrands: Strand[];
}

function getAgeHours(post: AppPost) {
  const createdMs = timestampToMillis(post.created_at);
  if (!createdMs) return 999;
  return Math.max(0, (Date.now() - createdMs) / 3_600_000);
}

function getEngagement(post: AppPost) {
  return post.likes_count * 6 + post.comments_count * 12;
}

export function getForYouScore(post: AppPost, context: FeedContext) {
  const freshness = Math.max(0, 72 - getAgeHours(post) * 2.5);
  const relationshipBoost = context.followingIds.includes(post.author_id) ? 30 : 0;
  const strandBoost = context.preferredStrands.includes(post.strand) ? 22 : 0;
  const ownershipBoost = context.userId && post.author_id === context.userId ? 8 : 0;
  const depthBoost = Math.min(post.body.length / 20, 12);

  return freshness + relationshipBoost + strandBoost + ownershipBoost + depthBoost + getEngagement(post);
}

export function getTrendingScore(post: AppPost) {
  const agePenalty = getAgeHours(post) * 4;
  return getEngagement(post) + Math.max(0, 40 - agePenalty);
}

export function sortPostsForTab(posts: AppPost[], tab: FeedTab, context: FeedContext) {
  if (tab === "following") {
    return posts
      .filter((post) => context.followingIds.includes(post.author_id))
      .sort((a, b) => timestampToMillis(b.created_at) - timestampToMillis(a.created_at));
  }

  if (tab === "latest") {
    return [...posts].sort((a, b) => timestampToMillis(b.created_at) - timestampToMillis(a.created_at));
  }

  if (tab === "trending") {
    return [...posts].sort((a, b) => getTrendingScore(b) - getTrendingScore(a));
  }

  return [...posts].sort((a, b) => getForYouScore(b, context) - getForYouScore(a, context));
}

export function getRecommendationReason(post: AppPost, context: FeedContext) {
  if (context.followingIds.includes(post.author_id)) {
    return "From someone you follow";
  }

  if (context.preferredStrands.includes(post.strand)) {
    return `Aligned with your ${STRAND_LABELS[post.strand].toLowerCase()} interests`;
  }

  if (post.comments_count >= 3 || post.likes_count >= 5) {
    return "Momentum is building around this post";
  }

  return "Fresh conversation from the community";
}

export function getTrendingTags(posts: AppPost[]) {
  const tagCounts = new Map<string, number>();

  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });

  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
}

export function getFeedHighlights(posts: AppPost[]) {
  const totalEngagement = posts.reduce(
    (sum, post) => sum + post.likes_count + post.comments_count,
    0,
  );
  const authorCount = new Set(posts.map((post) => post.author_id)).size;
  const strandCounts = posts.reduce<Record<Strand, number>>(
    (acc, post) => {
      acc[post.strand] += 1;
      return acc;
    },
    { N: 0, E: 0, S: 0, W: 0 },
  );

  const dominantStrand = Object.entries(strandCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
    | Strand
    | undefined;

  return {
    authorCount,
    totalEngagement,
    dominantStrand: dominantStrand ? STRAND_LABELS[dominantStrand] : "Society",
  };
}
