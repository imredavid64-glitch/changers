import { AppBadge, AppProfile, BadgeCategory, BadgeDefinition, UserStats } from "@/lib/social/types";
import { TINTS } from "@/lib/theme/tints";

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-post",
    name: "First Voice",
    description: "Published your first post",
    icon: "🎤",
    category: "milestone",
    condition: (_, stats) => stats.postsCount >= 1,
  },
  {
    id: "post-10",
    name: "Active Contributor",
    description: "Published 10 posts",
    icon: "📝",
    category: "milestone",
    condition: (_, stats) => stats.postsCount >= 10,
  },
  {
    id: "post-50",
    name: "Prolific Writer",
    description: "Published 50 posts",
    icon: "✍️",
    category: "milestone",
    condition: (_, stats) => stats.postsCount >= 50,
  },
  {
    id: "first-project",
    name: "Project Founder",
    description: "Created your first project",
    icon: "🚀",
    category: "creation",
    condition: (_, stats) => stats.projectsCount >= 1,
  },
  {
    id: "project-5",
    name: "Community Builder",
    description: "Created 5 projects",
    icon: "🏗️",
    category: "creation",
    condition: (_, stats) => stats.projectsCount >= 5,
  },
  {
    id: "first-document",
    name: "Documentarian",
    description: "Created your first document",
    icon: "📄",
    category: "creation",
    condition: (_, stats) => stats.documentsCount >= 1,
  },
  {
    id: "documents-10",
    name: "Knowledge Curator",
    description: "Created 10 documents",
    icon: "📚",
    category: "creation",
    condition: (_, stats) => stats.documentsCount >= 10,
  },
  {
    id: "first-slideshow",
    name: "Presenter",
    description: "Created your first slideshow",
    icon: "📽️",
    category: "creation",
    condition: (_, stats) => stats.slideshowsCount >= 1,
  },
  {
    id: "follower-10",
    name: "Rising Star",
    description: "Gained 10 followers",
    icon: "⭐",
    category: "social",
    condition: (_, stats) => stats.followersCount >= 10,
  },
  {
    id: "follower-50",
    name: "Influencer",
    description: "Gained 50 followers",
    icon: "🌟",
    category: "social",
    condition: (_, stats) => stats.followersCount >= 50,
  },
  {
    id: "follower-100",
    name: "Community Leader",
    description: "Gained 100 followers",
    icon: "👑",
    category: "social",
    condition: (_, stats) => stats.followersCount >= 100,
  },
  {
    id: "following-10",
    name: "Networker",
    description: "Following 10 changemakers",
    icon: "🤝",
    category: "social",
    condition: (_, stats) => stats.followingCount >= 10,
  },
  {
    id: "likes-50",
    name: "Appreciated",
    description: "Received 50 likes on your posts",
    icon: "👏",
    category: "impact",
    condition: (_, stats) => stats.likesReceived >= 50,
  },
  {
    id: "likes-200",
    name: "Beloved Contributor",
    description: "Received 200 likes on your posts",
    icon: "❤️",
    category: "impact",
    condition: (_, stats) => stats.likesReceived >= 200,
  },
  {
    id: "comments-20",
    name: "Conversation Starter",
    description: "Received 20 comments on your posts",
    icon: "💬",
    category: "impact",
    condition: (_, stats) => stats.commentsReceived >= 20,
  },
  {
    id: "streak-3",
    name: "Getting Started",
    description: "3-day activity streak",
    icon: "🔥",
    category: "streak",
    condition: (_, stats) => stats.currentStreak >= 3,
  },
  {
    id: "streak-7",
    name: "Week Warrior",
    description: "7-day activity streak",
    icon: "🔥",
    category: "streak",
    condition: (_, stats) => stats.currentStreak >= 7,
  },
  {
    id: "streak-30",
    name: "Monthly Master",
    description: "30-day activity streak",
    icon: "🔥",
    category: "streak",
    condition: (_, stats) => stats.currentStreak >= 30,
  },
  {
    id: "longest-streak-14",
    name: "Consistency Champion",
    description: "Achieved a 14-day streak",
    icon: "🏆",
    category: "streak",
    condition: (_, stats) => stats.longestStreak >= 14,
  },
  {
    id: "tasks-10",
    name: "Task Master",
    description: "Completed 10 project tasks",
    icon: "✅",
    category: "milestone",
    condition: (_, stats) => stats.tasksCompleted >= 10,
  },
  {
    id: "tasks-50",
    name: "Productivity Pro",
    description: "Completed 50 project tasks",
    icon: "🎯",
    category: "milestone",
    condition: (_, stats) => stats.tasksCompleted >= 50,
  },
  {
    id: "event-host",
    name: "Event Host",
    description: "Hosted your first event",
    icon: "🎪",
    category: "creation",
    condition: (_, stats) => stats.eventsHosted >= 1,
  },
  {
    id: "event-host-5",
    name: "Community Organizer",
    description: "Hosted 5 events",
    icon: "🗓️",
    category: "creation",
    condition: (_, stats) => stats.eventsHosted >= 5,
  },
  {
    id: "event-attendee-5",
    name: "Active Participant",
    description: "Attended 5 events",
    icon: "🎟️",
    category: "social",
    condition: (_, stats) => stats.eventsAttended >= 5,
  },
  {
    id: "mentor",
    name: "Mentor",
    description: "Became a recognized mentor",
    icon: "🎓",
    category: "special",
    condition: (profile) => profile.is_mentor === true,
  },
  {
    id: "early-adopter",
    name: "Early Adopter",
    description: "Joined in the first 100 users",
    icon: "🌱",
    category: "special",
    condition: (profile, stats) => stats.daysSinceJoin <= 30,
  },
  {
    id: "impact-trailblazer",
    name: "Trailblazer",
    description: "Reached Trailblazer impact level",
    icon: "🏔️",
    category: "impact",
    condition: (_, stats) => stats.impactScore >= 1000,
  },
  {
    id: "strand-nature",
    name: "Nature Guardian",
    description: "Created 5 Nature-strand posts/projects",
    icon: "🌿",
    category: "impact",
    condition: (_, stats) => (stats.strandCounts?.N ?? 0) >= 5,
  },
  {
    id: "strand-economy",
    name: "Economy Innovator",
    description: "Created 5 Economy-strand posts/projects",
    icon: "💡",
    category: "impact",
    condition: (_, stats) => (stats.strandCounts?.E ?? 0) >= 5,
  },
  {
    id: "strand-society",
    name: "Society Builder",
    description: "Created 5 Society-strand posts/projects",
    icon: "🤝",
    category: "impact",
    condition: (_, stats) => (stats.strandCounts?.S ?? 0) >= 5,
  },
  {
    id: "strand-wellbeing",
    name: "Wellbeing Advocate",
    description: "Created 5 Wellbeing-strand posts/projects",
    icon: "🧘",
    category: "impact",
    condition: (_, stats) => (stats.strandCounts?.W ?? 0) >= 5,
  },
];

export function getBadgeDefinitions(): BadgeDefinition[] {
  return BADGE_DEFINITIONS;
}

export function getBadgeDefinition(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === id);
}

export function getBadgesByCategory(category: BadgeCategory): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter((b) => b.category === category);
}

export async function checkAndAwardBadges(
  userId: string,
  profile: AppProfile,
  stats: UserStats,
  getExistingBadges: () => Promise<AppBadge[]>,
  awardBadge: (badge: Omit<AppBadge, "id" | "earned_at">) => Promise<AppBadge>
): Promise<AppBadge[]> {
  const existingBadges = await getExistingBadges();
  const existingBadgeIds = new Set(existingBadges.map((b) => b.badge_id));
  const newlyAwarded: AppBadge[] = [];

  for (const definition of BADGE_DEFINITIONS) {
    if (existingBadgeIds.has(definition.id)) continue;

    try {
      const earned = definition.condition(profile, stats);
      if (earned) {
        const badge = await awardBadge({
          user_id: userId,
          badge_id: definition.id,
          badge_name: definition.name,
          badge_description: definition.description,
          badge_icon: definition.icon,
          badge_category: definition.category,
          metadata: { awarded_by: "auto", condition_id: definition.id },
        });
        newlyAwarded.push(badge);
        existingBadgeIds.add(definition.id);
      }
    } catch (error) {
      console.error(`Error checking badge ${definition.id}:`, error);
    }
  }

  return newlyAwarded;
}

export function getBadgeDisplayName(badge: AppBadge): string {
  return `${badge.badge_icon} ${badge.badge_name}`;
}

export function getCategoryLabel(category: BadgeCategory): string {
  const labels: Record<BadgeCategory, string> = {
    milestone: "Milestones",
    social: "Community",
    creation: "Creation",
    impact: "Impact",
    streak: "Streaks",
    special: "Special",
  };
  return labels[category] || category;
}

export function getCategoryColor(category: BadgeCategory): string {
  const colors: Record<BadgeCategory, string> = {
    milestone: TINTS.teal15,
    social: TINTS.coral15,
    creation: "color-mix(in srgb, var(--sun) 15%, transparent)",
    impact: "rgba(155,199,177,0.2)",
    streak: TINTS.coral20,
    special: "rgba(147,197,253,0.2)",
  };
  return colors[category] || "var(--surface-track)";
}