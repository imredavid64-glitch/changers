import { describe, expect, it } from "vitest";
import { computeBadgeProgress } from "./progress";
import type { AppProfile, UserStats } from "@/lib/social/types";

const EMPTY_STATS: UserStats = {
  postsCount: 0,
  projectsCount: 0,
  documentsCount: 0,
  slideshowsCount: 0,
  followersCount: 0,
  followingCount: 0,
  likesReceived: 0,
  commentsReceived: 0,
  daysSinceJoin: 0,
  currentStreak: 0,
  longestStreak: 0,
  tasksCompleted: 0,
  eventsHosted: 0,
  eventsAttended: 0,
  impactScore: 0,
  strandCounts: {},
};

const BASE_PROFILE: AppProfile = {
  id: "u1",
  full_name: "Ada",
  role: "Student",
  headline: "",
  bio: "",
  location: "",
  avatar_file_id: "",
  avatar_media_id: "",
  avatar_media_storage_key: "",
  avatar_media_url: "",
  avatar_url: "",
  interests: ["S"],
  saved_project_ids: [],
  is_mentor: false,
  mentor_focus: "",
  is_admin: false,
  privacy: "public",
  theme: "moss",
  search_index: "ada",
};

describe("computeBadgeProgress", () => {
  it("reports locked badges with a 0 fraction by default", () => {
    const progress = computeBadgeProgress(BASE_PROFILE, EMPTY_STATS);
    const firstPost = progress.find((p) => p.badge.id === "first-post");
    expect(firstPost?.earned).toBe(false);
    expect(firstPost?.fraction).toBe(0);
    expect(firstPost?.label).toBe("Locked");
  });

  it("marks count thresholds partially complete", () => {
    const stats = { ...EMPTY_STATS, postsCount: 4 };
    const progress = computeBadgeProgress(BASE_PROFILE, stats);
    const post10 = progress.find((p) => p.badge.id === "post-10")!;
    expect(post10.fraction).toBeCloseTo(0.4);
    expect(post10.label).toBe("4 / 10");

    const firstPost = progress.find((p) => p.badge.id === "first-post")!;
    expect(firstPost.earned).toBe(true);
    expect(firstPost.fraction).toBe(1);
  });

  it("caps progress at 1 and shows earned", () => {
    const stats = { ...EMPTY_STATS, followersCount: 25 };
    const progress = computeBadgeProgress(BASE_PROFILE, stats);
    const follower50 = progress.find((p) => p.badge.id === "follower-50")!;
    expect(follower50.fraction).toBe(0.5);
    const follower10 = progress.find((p) => p.badge.id === "follower-10")!;
    expect(follower10.earned).toBe(true);
    expect(follower10.fraction).toBe(1);
    expect(follower10.label).toBe("10 / 10");
  });

  it("handles strand badges from strand counts", () => {
    const stats = { ...EMPTY_STATS, strandCounts: { N: 3 } };
    const progress = computeBadgeProgress(BASE_PROFILE, stats);
    const nature = progress.find((p) => p.badge.id === "strand-nature")!;
    expect(nature.fraction).toBeCloseTo(0.6);
    expect(nature.label).toBe("3 / 5");
  });

  it("treats boolean badges as earned or locked", () => {
    const mentor = computeBadgeProgress({ ...BASE_PROFILE, is_mentor: true }, EMPTY_STATS);
    expect(mentor.find((p) => p.badge.id === "mentor")?.earned).toBe(true);
    expect(mentor.find((p) => p.badge.id === "mentor")?.label).toBe("Earned");
  });

  it("covers every badge definition", () => {
    const progress = computeBadgeProgress(BASE_PROFILE, EMPTY_STATS);
    // 31 definitions in the catalog — every one must produce a progress row.
    expect(progress.length).toBeGreaterThanOrEqual(31);
    for (const row of progress) {
      expect(row.fraction).toBeGreaterThanOrEqual(0);
      expect(row.fraction).toBeLessThanOrEqual(1);
      expect(row.label.length).toBeGreaterThan(0);
    }
  });
});
