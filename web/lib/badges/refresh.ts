export interface BadgeCheckResult {
  userId: string;
  newlyAwarded: { badge_id: string; badge_name: string; badge_icon: string }[];
  totalEarned: number;
}

/**
 * Fire-and-forget check that asks the server to recompute a user's badge
 * eligibility and award any newly earned badges. Safe to call after creating
 * content or when a profile page loads — awarding is idempotent.
 */
export async function refreshBadges(userId?: string): Promise<BadgeCheckResult | null> {
  if (!userId) return null;

  try {
    const response = await fetch(`/api/badges/check?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as BadgeCheckResult;
  } catch {
    return null;
  }
}
