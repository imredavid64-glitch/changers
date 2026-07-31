"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { normalizeFilm, formatRelativeTime } from "@/lib/social/utils";
import { AppFilm } from "@/lib/social/types";

export default function FilmsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [films, setFilms] = useState<AppFilm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const queries = [Query.equal("user_id", user.$id), Query.orderDesc("updated_at_ms")];
    const unsub = watchDocuments(
      COLLECTIONS.films,
      queries,
      (doc) => normalizeFilm(doc.$id, doc as unknown as Record<string, unknown>),
      (docs) => {
        setFilms(docs);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsub;
  }, [user]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Film Maker</h1>
          <p className="muted">Sign in to create storyboards.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Storyboard tool</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>Film Maker</h1>
        </div>
        <Link href="/tools/films/new" className="primary" style={{ textDecoration: "none", padding: "10px 20px", borderRadius: 999 }}>
          + New film
        </Link>
      </div>

      {!loading && films.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {films.map((f) => (
            <button
              key={f.id}
              onClick={() => router.push(`/tools/films/${f.id}`)}
              className="card hover-lift"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", cursor: "pointer", textAlign: "left", border: "none", width: "100%", fontFamily: "inherit", fontSize: "inherit" }}
            >
              <div>
                <div className="collab-title" style={{ marginBottom: 4 }}>{f.title}</div>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  {f.scene_count} scenes · Updated {formatRelativeTime(f.updated_at)}
                </p>
              </div>
              <span style={{ fontSize: "0.85rem", color: "var(--moss)", fontWeight: 600 }}>Edit →</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted">Loading films...</p>
        </div>
      )}

      {!loading && films.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎬</div>
          <p className="muted">No films yet. Create your first storyboard!</p>
          <Link href="/tools/films/new" className="primary" style={{ display: "inline-block", marginTop: 16, textDecoration: "none", padding: "10px 20px", borderRadius: 999 }}>
            + New film
          </Link>
        </div>
      )}
    </div>
  );
}
