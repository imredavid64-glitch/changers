"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppBadge, BadgeCategory, UserStats } from "@/lib/social/types";
import { normalizeBadge } from "@/lib/social/utils";
import { getCategoryColor, getCategoryLabel } from "@/lib/badges/definitions";
import { computeBadgeProgress, type BadgeProgress } from "@/lib/badges/progress";

const CATEGORY_ORDER: BadgeCategory[] = ["milestone", "creation", "social", "impact", "streak", "special"];

export default function BadgesPage() {
  const { user, profile } = useAuth();
  const [earnedBadges, setEarnedBadges] = useState<AppBadge[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) return;

    let cancelled = false;

    const unsubscribe = watchDocuments(
      COLLECTIONS.badges,
      [Query.equal("user_id", user.$id), Query.orderDesc("earned_at_ms")],
      (doc) => normalizeBadge(doc.$id, doc),
      (loaded) => {
        if (!cancelled) setEarnedBadges(loaded);
      },
      () => {
        if (!cancelled) setEarnedBadges([]);
      },
    );

    fetch(`/api/badges/check?userId=${encodeURIComponent(user.$id)}`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { stats?: UserStats };
        if (!cancelled && data.stats) {
          setStats(data.stats);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, profile]);

  const progress = useMemo<BadgeProgress[] | null>(() => {
    if (!profile || !stats) return null;
    return computeBadgeProgress(profile, stats);
  }, [profile, stats]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Badges</h1>
          <p className="muted">Sign in to see your achievements and progress.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const earnedCount = earnedBadges.length;
  const totalCount = progress?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: "grid", gap: 24 }}
    >
      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Achievements</p>
            <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)", display: "flex", alignItems: "center", gap: 10 }}>
              <Trophy size={26} style={{ color: "var(--moss)" }} /> Badges
            </h1>
            <p className="muted">30+ achievements for milestones, streaks, community building, and strand leadership.</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 8 }}>
          <div className="mini-card">
            <p className="meta-label">Earned</p>
            <p className="meta-value">{loading ? "…" : earnedCount} / {totalCount || "…"}</p>
          </div>
          <div className="mini-card">
            <p className="meta-label">Progress</p>
            <p className="meta-value" style={{ fontSize: "0.95rem" }}>
              {loading || !totalCount ? "…" : `${Math.round((earnedCount / totalCount) * 100)}%`}
            </p>
          </div>
        </div>

        {loading || !progress ? (
          <p className="muted" style={{ padding: 40, textAlign: "center" }}>Checking your achievements...</p>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const rows = progress.filter((row) => row.badge.category === category);
            if (rows.length === 0) return null;
            const earnedInCategory = rows.filter((row) => row.earned).length;

            return (
              <div key={category} style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <h3 style={{ fontFamily: "var(--font-head)" }}>{getCategoryLabel(category)}</h3>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>{earnedInCategory} / {rows.length} earned</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                  {rows.map(({ badge, earned, fraction, label }) => (
                    <div
                      key={badge.id}
                      style={{
                        padding: "14px",
                        borderRadius: 16,
                        background: earned ? "var(--surface-card-solid)" : "color-mix(in srgb, var(--ink) 3%, transparent)",
                        border: earned ? "1px solid var(--surface-track)" : "1px dashed var(--border-control-soft)",
                        display: "grid",
                        gap: 8,
                        transition: "transform 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: "1.6rem", lineHeight: 1, filter: earned ? "none" : "grayscale(100%)" }}>
                          {badge.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{badge.name}</p>
                          <p className="muted" style={{ fontSize: "0.75rem", lineHeight: 1.35 }}>{badge.description}</p>
                        </div>
                      </div>
                      <div>
                        <div className="progress" style={{ margin: 0 }}>
                          <div className="bar">
                            <div
                              className="bar-fill"
                              style={{
                                width: `${Math.round(fraction * 100)}%`,
                                background: earned ? "var(--moss)" : getCategoryColor(category),
                              }}
                            />
                          </div>
                        </div>
                        <p style={{ fontSize: "0.72rem", marginTop: 6, fontWeight: 600, color: earned ? "var(--moss)" : "var(--ink)" }}>
                          {earned ? "✓ " : ""}{label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </motion.div>
  );
}
