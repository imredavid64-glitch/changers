/**
 * QA fixtures for the fake-data seam (`changers-fake-data=1`).
 *
 * The plain fake-user seam (changers-fake-user) renders the signed-in shell
 * with a mock identity but no data, so data-driven states never render (e.g.
 * /badges shows "Checking your achievements..." forever and /impact shows
 * zeroed strand cards). Setting changers-fake-data additionally feeds this
 * deterministic fixture data — a non-admin profile, stats that earn a realistic
 * mix of badges, and posts spread across strands — so the badge-earned and
 * impact-score surfaces are exercised in tests and the contrast audit.
 *
 * The seam is UI-only and dormant unless the flag is set in the browser; every
 * API route still requires a real Appwrite JWT.
 */
import type { AppBadge, AppPost, AppProfile, UserStats } from "@/lib/social/types";

export const FAKE_DATA_KEY = "changers-fake-data";

export function isFakeDataMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FAKE_DATA_KEY) === "1";
}

/** Non-admin profile so admin-gated pages keep rendering their access states. */
export const FAKE_PROFILE: AppProfile = {
  id: "e2e-qa-user",
  full_name: "QA Tester",
  role: "Student",
  headline: "Building a plastic-free campus",
  bio: "Focused on sustainability projects across the Nature and Society strands.",
  location: "Budapest",
  avatar_file_id: "",
  avatar_media_id: "",
  avatar_media_storage_key: "",
  avatar_media_url: "",
  avatar_url: "",
  interests: ["N", "S", "W"],
  saved_project_ids: [],
  is_mentor: false,
  mentor_focus: "",
  is_admin: false,
  privacy: "public",
  theme: "moss",
  impact_score: 340,
  strand_counts: { N: 6, E: 3, S: 2, W: 1 },
  search_index: "QA Tester Student sustainability",
};

/**
 * Stats tuned to earn a realistic mix of badges: milestone (first-post,
 * post-10, first-project, first-document), social (follower-10, likes-50,
 * comments-20), creation (first-slideshow, tasks-10, event-host) and streak
 * (streak-3) — while leaving many unearned so both card styles render.
 */
export const FAKE_STATS: UserStats = {
  postsCount: 12,
  projectsCount: 2,
  documentsCount: 1,
  slideshowsCount: 1,
  followersCount: 24,
  followingCount: 8,
  likesReceived: 87,
  commentsReceived: 26,
  daysSinceJoin: 120,
  currentStreak: 5,
  longestStreak: 12,
  tasksCompleted: 12,
  eventsHosted: 2,
  eventsAttended: 6,
  impactScore: 340,
  strandCounts: { N: 6, E: 3, S: 2, W: 1 },
};

const EARNED_BADGE_IDS = [
  "first-post",
  "post-10",
  "first-project",
  "first-document",
  "follower-10",
  "likes-50",
  "comments-20",
  "streak-3",
  "first-slideshow",
  "tasks-10",
  "event-host",
];

const BADGE_META: Record<string, { name: string; description: string; icon: string; category: AppBadge["badge_category"] }> = {
  "first-post": { name: "First Post", description: "Shared your first post.", icon: "🌱", category: "milestone" },
  "post-10": { name: "Ten Posts", description: "Shared 10 posts.", icon: "📝", category: "milestone" },
  "first-project": { name: "Project Starter", description: "Launched your first project.", icon: "🚀", category: "milestone" },
  "first-document": { name: "Documenter", description: "Created your first document.", icon: "📄", category: "creation" },
  "follower-10": { name: "Growing Circle", description: "Gained 10 followers.", icon: "🤝", category: "social" },
  "likes-50": { name: "Community Favorite", description: "Received 50 reactions.", icon: "❤️", category: "social" },
  "comments-20": { name: "Conversation Starter", description: "Received 20 comments.", icon: "💬", category: "social" },
  "streak-3": { name: "Momentum", description: "Kept a 3-day streak.", icon: "🔥", category: "streak" },
  "first-slideshow": { name: "Pitch Builder", description: "Created your first slideshow.", icon: "📽️", category: "creation" },
  "tasks-10": { name: "Task Crusher", description: "Completed 10 tasks.", icon: "✅", category: "creation" },
  "event-host": { name: "Gatherer", description: "Hosted your first event.", icon: "🎪", category: "social" },
};

export const FAKE_EARNED_BADGES: AppBadge[] = EARNED_BADGE_IDS.map((badgeId, index) => ({
  id: `badge-${index + 1}`,
  user_id: "e2e-qa-user",
  badge_id: badgeId,
  badge_name: BADGE_META[badgeId].name,
  badge_description: BADGE_META[badgeId].description,
  badge_icon: BADGE_META[badgeId].icon,
  badge_category: BADGE_META[badgeId].category,
  earned_at: Date.now() - (index + 1) * 86_400_000,
}));

function post(
  index: number,
  strand: AppPost["strand"],
  title: string,
  likes: number,
  comments: number,
): AppPost {
  return {
    id: `post-${index}`,
    title,
    body: "A fixture post for QA contrast coverage.",
    strand,
    author_id: "e2e-qa-user",
    author_name: "QA Tester",
    author_role: "Student",
    author_avatar_file_id: "",
    author_avatar_media_id: "",
    author_avatar_media_storage_key: "",
    author_avatar_media_url: "",
    author_avatar_url: "",
    image_file_id: "",
    image_media_id: "",
    image_media_storage_key: "",
    image_media_url: "",
    image_url: "",
    video_url: "",
    is_poll: false,
    poll_question: "",
    poll_options: [],
    poll_votes: {},
    video_file_id: "",
    video_media_id: "",
    video_media_storage_key: "",
    likes: [],
    likes_count: likes,
    comments_count: comments,
    tags: ["fixture"],
    search_index: "",
    created_at: Date.now() - index * 3_600_000,
    updated_at: Date.now() - index * 3_600_000,
  };
}

/** Posts spread across strands so /impact renders non-zero scores and a dominant strand. */
export const FAKE_POSTS: AppPost[] = [
  post(1, "N", "River clean-up day", 24, 6),
  post(2, "N", "Composting at the canteen", 18, 4),
  post(3, "N", "Native tree nursery plan", 15, 3),
  post(4, "N", "Plastic audit results", 12, 2),
  post(5, "N", "Pollinator garden seeds", 9, 1),
  post(6, "N", "Rainwater capture at school", 7, 2),
  post(7, "E", "Circular stationery swap", 11, 3),
  post(8, "E", "Fair-trade snack stall", 6, 1),
  post(9, "E", "Second-hand uniform drive", 4, 1),
  post(10, "S", "Inclusion workshop", 8, 2),
  post(11, "S", "Buddy program launch", 5, 1),
  post(12, "W", "Wellbeing walk club", 6, 2),
];
