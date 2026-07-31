"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { normalizeDesign, formatRelativeTime } from "@/lib/social/utils";
import { AppDesign } from "@/lib/social/types";

export default function DesignsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [designs, setDesigns] = useState<AppDesign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const queries = [Query.equal("user_id", user.$id), Query.orderDesc("updated_at_ms")];
    const unsub = watchDocuments(
      COLLECTIONS.designs,
      queries,
      (doc) => normalizeDesign(doc.$id, doc as unknown as Record<string, unknown>),
      (docs) => {
        setDesigns(docs);
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
          <h1>Designer</h1>
          <p className="muted">Sign in to create and manage your designs.</p>
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
          <p className="eyebrow">Canvas tool</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>Designer</h1>
        </div>
        <Link href="/tools/design/new" className="primary" style={{ textDecoration: "none", padding: "10px 20px", borderRadius: 999 }}>
          + New design
        </Link>
      </div>

      {!loading && designs.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {designs.map((design) => (
            <button
              key={design.id}
              onClick={() => router.push(`/tools/design/${design.id}`)}
              className="card hover-lift"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", cursor: "pointer", textAlign: "left", border: "none", width: "100%", fontFamily: "inherit", fontSize: "inherit" }}
            >
              <div>
                <div className="collab-title" style={{ marginBottom: 4 }}>{design.title}</div>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  {design.elements.length} elements · {design.canvas_width}×{design.canvas_height} · Updated {formatRelativeTime(design.updated_at)}
                </p>
              </div>
              <span style={{ fontSize: "0.85rem", color: "var(--moss)", fontWeight: 600 }}>Edit →</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted">Loading designs...</p>
        </div>
      )}

      {!loading && designs.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎨</div>
          <p className="muted">No designs yet. Create your first canvas!</p>
          <Link href="/tools/design/new" className="primary" style={{ display: "inline-block", marginTop: 16, textDecoration: "none", padding: "10px 20px", borderRadius: 999 }}>
            + New design
          </Link>
        </div>
      )}
    </div>
  );
}
