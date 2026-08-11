import type { AppProfile, BadgeDefinition, Strand, UserStats } from "@/lib/social/types";
import { getBadgeDefinitions } from "@/lib/badges/definitions";

export interface BadgeProgress {
  badge: BadgeDefinition;
  earned: boolean;
  /** Current progress toward the goal (0..1). Boolean badges are 0 or 1. */
  fraction: number;
  /** Human-readable progress, e.g. "3 / 10". */
  label: string;
}

const STRAND_BADGES: Record<string, Strand> = {
  "strand-nature": "N",
  "strand-economy": "E",
  "strand-society": "S",
  "strand-wellbeing": "W",
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function computeBadgeProgress(profile: AppProfile, stats: UserStats): BadgeProgress[] {
  const definitions = getBadgeDefinitions();

  return definitions.map((badge) => {
    const earned = badge.condition(profile, stats);

    let current = 0;
    let target = 1;

    const countTarget = (value: number, goal: number) => {
      current = value;
      target = goal;
    };

    switch (badge.id) {
      case "first-post": countTarget(stats.postsCount, 1); break;
      case "post-10": countTarget(stats.postsCount, 10); break;
      case "post-50": countTarget(stats.postsCount, 50); break;
      case "first-project": countTarget(stats.projectsCount, 1); break;
      case "project-5": countTarget(stats.projectsCount, 5); break;
      case "first-document": countTarget(stats.documentsCount, 1); break;
      case "documents-10": countTarget(stats.documentsCount, 10); break;
      case "first-slideshow": countTarget(stats.slideshowsCount, 1); break;
      case "follower-10": countTarget(stats.followersCount, 10); break;
      case "follower-50": countTarget(stats.followersCount, 50); break;
      case "follower-100": countTarget(stats.followersCount, 100); break;
      case "following-10": countTarget(stats.followingCount, 10); break;
      case "likes-50": countTarget(stats.likesReceived, 50); break;
      case "likes-200": countTarget(stats.likesReceived, 200); break;
      case "comments-20": countTarget(stats.commentsReceived, 20); break;
      case "streak-3": countTarget(stats.currentStreak, 3); break;
      case "streak-7": countTarget(stats.currentStreak, 7); break;
      case "streak-30": countTarget(stats.currentStreak, 30); break;
      case "longest-streak-14": countTarget(stats.longestStreak, 14); break;
      case "tasks-10": countTarget(stats.tasksCompleted, 10); break;
      case "tasks-50": countTarget(stats.tasksCompleted, 50); break;
      case "event-host": countTarget(stats.eventsHosted, 1); break;
      case "event-host-5": countTarget(stats.eventsHosted, 5); break;
      case "event-attendee-5": countTarget(stats.eventsAttended, 5); break;
      case "impact-trailblazer": countTarget(stats.impactScore, 1000); break;
      default: {
        const strand = STRAND_BADGES[badge.id];
        if (strand) {
          countTarget(stats.strandCounts?.[strand] ?? 0, 5);
        } else if (badge.id === "early-adopter") {
          current = Math.max(0, 30 - stats.daysSinceJoin);
          target = 30;
        } else {
          // Boolean badge (mentor, etc.): earned or not.
          current = earned ? 1 : 0;
          target = 1;
        }
      }
    }

    const label =
      target === 1
        ? earned
          ? "Earned"
          : "Locked"
        : `${Math.min(current, target)} / ${target}`;

    return { badge, earned, fraction: clamp01(current / target), label };
  });
}
