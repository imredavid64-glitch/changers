"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { COLLECTIONS, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { normalizeCodeSnippet, formatRelativeTime } from "@/lib/social/utils";
import { AppCodeSnippet } from "@/lib/social/types";

export default function CodeSnippetsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [snippets, setSnippets] = useState<AppCodeSnippet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const queries = [Query.equal("user_id", user.$id), Query.orderDesc("updated_at_ms")];
    const unsub = watchDocuments(
      COLLECTIONS.codeSnippets,
      queries,
      (doc) => normalizeCodeSnippet(doc.$id, doc as unknown as Record<string, unknown>),
      (docs) => {
        setSnippets(docs);
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
          <h1>Code Maker</h1>
          <p className="muted">Sign in to create and manage your code snippets.</p>
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
          <p className="eyebrow">Code snippets</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>Code Maker</h1>
        </div>
        <Link href="/tools/code/new" className="primary" style={{ padding: "10px 20px", borderRadius: 999, textDecoration: "none" }}>
          + New snippet
        </Link>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <p className="muted">Loading snippets...</p>
        </div>
      ) : snippets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>💻</div>
          <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 8 }}>No code snippets yet</h3>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
            Create your first code snippet to save and share code.
          </p>
          <Link href="/tools/code/new" className="primary" style={{ padding: "10px 24px", borderRadius: 999, textDecoration: "none", display: "inline-block" }}>
            Create your first snippet
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {snippets.map((snippet) => (
            <button
              key={snippet.id}
              onClick={() => router.push(`/tools/code/${snippet.id}`)}
              className="card hover-lift"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", cursor: "pointer", textAlign: "left", border: "none", width: "100%", fontFamily: "inherit", fontSize: "inherit" }}
            >
              <div>
                <div className="collab-title" style={{ marginBottom: 4 }}>{snippet.title}</div>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Updated {formatRelativeTime(snippet.updated_at)}
                </p>
              </div>
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 999,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  background: "color-mix(in srgb, var(--teal) 12%, transparent)",
                  color: "var(--moss)",
                  textTransform: "uppercase",
                }}
              >
                {snippet.language}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
