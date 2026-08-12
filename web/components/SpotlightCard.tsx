"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Spotlight {
  id: string;
  title: string;
  blurb: string;
  profileUrl: string | null;
  projectUrl: string | null;
  strand: string | null;
}

const STRAND_LABELS: Record<string, string> = {
  N: "Nature",
  E: "Economy",
  S: "Society",
  W: "Wellbeing",
};

/**
 * Weekly Changer Spotlight: shows the admin-curated featured changemaker or
 * project. Hides itself when no spotlight is active (or storage is down), so
 * it is a pure progressive enhancement.
 */
export default function SpotlightCard() {
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/spotlight")
      .then((response) => (response.ok ? response.json() : { spotlight: null }))
      .then((payload: { spotlight?: Spotlight | null }) => {
        setSpotlight(payload.spotlight ?? null);
      })
      .catch(() => setSpotlight(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  if (!spotlight) return null;

  return (
    <section className="card spotlight-card" aria-label="Changer Spotlight">
      <div className="composer-header">
        <div>
          <p className="eyebrow">
            <Sparkles size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
            Changer Spotlight
          </p>
          <h2 style={{ fontSize: "1.3rem", marginBottom: 6 }}>{spotlight.title}</h2>
          <p className="muted" style={{ marginBottom: 0 }}>{spotlight.blurb}</p>
        </div>
        {spotlight.strand && (
          <span className="strand" title={STRAND_LABELS[spotlight.strand]}>
            {STRAND_LABELS[spotlight.strand] ?? spotlight.strand}
          </span>
        )}
      </div>
      {(spotlight.profileUrl || spotlight.projectUrl) && (
        <div className="button-row" style={{ marginTop: 12 }}>
          {spotlight.profileUrl && (
            <Link href={spotlight.profileUrl} className="ghost" style={{ textDecoration: "none", display: "inline-block" }}>
              View profile
            </Link>
          )}
          {spotlight.projectUrl && (
            <Link href={spotlight.projectUrl} className="primary" style={{ textDecoration: "none", display: "inline-block" }}>
              View project
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
