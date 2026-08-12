"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Rocket, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, listDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import {
  buildChecklist,
  type OnboardingCounts,
} from "@/lib/onboarding/checklist";

const DISMISS_KEY = "changers.onboarding.dismissed";

const EMPTY_COUNTS: OnboardingCounts = { posts: 0, rooms: 0, projects: 0 };

/**
 * First-run checklist card shown on the home feed. Completion is derived from
 * existing data (profile + activity counts), so it needs no extra storage and
 * re-evaluates itself on every visit. Dismissed (per-browser) once complete.
 */
export function OnboardingChecklist() {
  const { user, profile } = useAuth();
  const [counts, setCounts] = useState<OnboardingCounts | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return (
        typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1"
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!user) return;
    const userId = user.$id;

    let active = true;

    async function load() {
      try {
        const [postDocs, roomDocs, projectDocs] = await Promise.allSettled([
          listDocuments(COLLECTIONS.posts, [Query.equal("author_id", userId), Query.limit(1)]),
          listDocuments(COLLECTIONS.rooms, [Query.limit(200)]),
          listDocuments(COLLECTIONS.projects, [Query.equal("owner_id", userId), Query.limit(1)]),
        ]);

        if (!active) return;

        const ok = <T,>(result: PromiseSettledResult<T>): T | null =>
          result.status === "fulfilled" ? result.value : null;

        const rooms = (ok(roomDocs) ?? []).filter((room) =>
          room.members?.includes(userId),
        ).length;

        setCounts({
          posts: ok(postDocs)?.length ?? 0,
          rooms,
          projects: ok(projectDocs)?.length ?? 0,
        });
      } catch {
        // Leave counts null so the checklist stays hidden rather than blocking the feed.
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user || dismissed || !counts) return null;

  const checklist = buildChecklist(
    profile,
    counts ?? EMPTY_COUNTS,
    `/profile/${user.$id}`,
  );
  if (checklist.done) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Persistence is best-effort; the session dismiss still applies.
    }
  }

  const progress = Math.round((checklist.completedCount / checklist.total) * 100);

  return (
    <section className="card" style={{ padding: "20px 24px", position: "relative" }}>
      <button
        aria-label="Dismiss onboarding checklist"
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: 14,
          right: 16,
          border: "none",
          background: "transparent",
          color: "var(--moss)",
          cursor: "pointer",
          padding: 4,
          borderRadius: 8,
        }}
      >
        <X size={16} />
      </button>

      <p className="eyebrow">
        <Rocket size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
        Getting started
      </p>
      <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-head)", marginTop: 4 }}>
        Set up your changemaker profile
      </h2>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        Four quick steps to get the most out of Changers.
      </p>

      <div
        style={{
          marginTop: 14,
          height: 8,
          borderRadius: 999,
          background: "rgba(16,24,32,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--coral), var(--amber))",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
        {checklist.completedCount} of {checklist.total} complete
      </p>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {checklist.steps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(16,24,32,0.08)",
              background: step.complete ? "rgba(16,24,32,0.03)" : "var(--surface-card-solid)",
              opacity: step.complete ? 0.6 : 1,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                border: `2px solid ${step.complete ? "var(--moss)" : "rgba(16,24,32,0.25)"}`,
                background: step.complete ? "var(--moss)" : "transparent",
                color: "white",
              }}
            >
              {step.complete && <Check size={13} strokeWidth={3} />}
            </span>
            <span style={{ flex: 1 }}>
              <strong style={{ fontSize: "0.92rem", display: "block" }}>{step.label}</strong>
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                {step.description}
              </span>
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--moss)", fontWeight: 600 }}>
              {step.complete ? "Done" : "Start →"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
