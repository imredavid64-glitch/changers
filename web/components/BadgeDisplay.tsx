"use client";

import { useEffect, useState } from "react";
import { AppBadge, AppProfile } from "@/lib/social/types";
import { COLLECTIONS, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { normalizeBadge } from "@/lib/social/utils";
import { getBadgeDefinitions, getCategoryColor, getCategoryLabel } from "@/lib/badges/definitions";

interface BadgeDisplayProps {
  profile: AppProfile;
  compact?: boolean;
}

export function BadgeDisplay({ profile, compact = false }: BadgeDisplayProps) {
  const [earnedBadges, setEarnedBadges] = useState<AppBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    return watchDocuments(
      COLLECTIONS.badges,
      [Query.equal("user_id", profile.id), Query.orderDesc("earned_at_ms")],
      (doc) => normalizeBadge(doc.$id, doc),
      (loaded) => {
        setEarnedBadges(loaded);
        setLoading(false);
      },
      () => {
        setEarnedBadges([]);
        setLoading(false);
      }
    );
  }, [profile?.id]);

  const allDefinitions = getBadgeDefinitions();
  const earnedSet = new Set(earnedBadges.map((b) => b.badge_id));

  if (compact) {
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {loading ? (
          <span className="muted" style={{ fontSize: "0.8rem" }}>Loading badges...</span>
        ) : earnedBadges.length === 0 ? (
          <span className="muted" style={{ fontSize: "0.8rem" }}>No badges earned yet</span>
        ) : (
          earnedBadges.slice(0, 5).map((badge) => (
            <span
              key={badge.id}
              title={`${badge.badge_name}: ${badge.badge_description}`}
              style={{
                background: getCategoryColor(badge.badge_category),
                padding: "4px 8px",
                borderRadius: "999px",
                fontSize: "0.85rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontWeight: 600,
              }}
            >
              <span>{badge.badge_icon}</span>
              <span style={{ fontSize: "0.75rem" }}>{badge.badge_name}</span>
            </span>
          ))
        )}
        {earnedBadges.length > 5 && (
          <span className="chip">+{earnedBadges.length - 5} more</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="section-header" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-head)" }}>🏆 Badges & Achievements</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Earned {earnedBadges.length} of {allDefinitions.length} badges
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {allDefinitions.map((def) => {
          const isEarned = earnedSet.has(def.id);

          return (
            <div
              key={def.id}
              style={{
                padding: "14px",
                borderRadius: "16px",
                background: isEarned ? "var(--surface-card-solid)" : "rgba(16,24,32,0.03)",
                border: isEarned ? "1px solid rgba(16,24,32,0.1)" : "1px dashed rgba(16,24,32,0.12)",
                opacity: isEarned ? 1 : 0.55,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                transition: "transform 0.2s ease",
              }}
            >
              <div
                style={{
                  fontSize: "1.8rem",
                  lineHeight: 1,
                  filter: isEarned ? "none" : "grayscale(100%)",
                }}
              >
                {def.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--ink)" }}>
                    {def.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      background: getCategoryColor(def.category),
                      padding: "2px 6px",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  >
                    {getCategoryLabel(def.category)}
                  </span>
                </div>
                <p className="muted" style={{ fontSize: "0.75rem", marginTop: 2, lineHeight: 1.3 }}>
                  {def.description}
                </p>
                {isEarned && (
                  <p style={{ fontSize: "0.7rem", color: "var(--teal)", fontWeight: 600, marginTop: 4 }}>
                    ✓ Earned
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
