/**
 * First-run onboarding checklist.
 *
 * Completion is derived entirely from data that already exists (the user's
 * profile and their activity counts), so nothing new needs to be stored: the
 * checklist re-evaluates itself every time it renders.
 */

export type OnboardingCounts = {
  /** Number of posts the user has authored. */
  posts: number;
  /** Number of co-lab rooms the user is a member of. */
  rooms: number;
  /** Number of projects the user owns. */
  projects: number;
};

export type OnboardingProfile = {
  headline?: string;
  bio?: string;
  location?: string;
};

export type OnboardingStep = {
  id: "profile" | "post" | "room" | "project";
  label: string;
  description: string;
  href: string;
  complete: boolean;
};

export type OnboardingChecklist = {
  steps: OnboardingStep[];
  completedCount: number;
  total: number;
  done: boolean;
};

export const ONBOARDING_STEPS: Array<{
  id: OnboardingStep["id"];
  label: string;
  description: string;
  href: string;
}> = [
  {
    id: "profile",
    label: "Complete your profile",
    description: "Add a headline, bio, and location so changemakers know who you are.",
    href: "", // filled in per-user below
  },
  {
    id: "post",
    label: "Share your first post",
    description: "Post an idea, a win, or a call to action for the community.",
    href: "/posts",
  },
  {
    id: "room",
    label: "Join a co-lab room",
    description: "Find a topic room and start collaborating with other changemakers.",
    href: "/rooms",
  },
  {
    id: "project",
    label: "Start a project",
    description: "Turn an idea into a project with members, tasks, and status tracking.",
    href: "/projects",
  },
];

/** True when the profile has enough substance to count as "completed". */
export function isProfileComplete(profile?: OnboardingProfile | null): boolean {
  if (!profile) return false;
  const hasHeadline = Boolean(profile.headline && profile.headline.trim());
  const hasBio = Boolean(profile.bio && profile.bio.trim());
  const hasLocation = Boolean(profile.location && profile.location.trim());
  return hasHeadline && hasBio && hasLocation;
}

export function buildChecklist(
  profile: OnboardingProfile | null | undefined,
  counts: OnboardingCounts,
  ownProfileHref = "",
): OnboardingChecklist {
  const completion: Record<OnboardingStep["id"], boolean> = {
    profile: isProfileComplete(profile),
    post: counts.posts > 0,
    room: counts.rooms > 0,
    project: counts.projects > 0,
  };

  const steps: OnboardingStep[] = ONBOARDING_STEPS.map((step) => ({
    ...step,
    href: step.id === "profile" && ownProfileHref ? ownProfileHref : step.href,
    complete: completion[step.id],
  }));

  const completedCount = steps.filter((step) => step.complete).length;
  return {
    steps,
    completedCount,
    total: steps.length,
    done: completedCount === steps.length,
  };
}
