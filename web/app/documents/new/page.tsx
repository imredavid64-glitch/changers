"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, createDocument, publicReadOwnerWritePermissions } from "@/lib/appwrite/bridge";
import { AISuggestion } from "@/lib/ai/tools";
import { AIPanel } from "@/components/AIPanel";
import { buildDocumentSearchIndex } from "@/lib/social/toolSearch";

export default function NewDocumentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const analyzeDocument = useCallback(async () => {
    setShowSuggestions(true);
    setError("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze-document", data: { title, content: body } }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestions([]);
        setError(data.error || "AI analysis failed.");
      }
    } catch {
      setSuggestions([]);
      setError("AI analysis failed. Please try again.");
    }
  }, [title, body]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>New document</h1>
          <p className="muted">Sign in to create documents.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  async function handleSave() {
    if (!title.trim() || !user) return;
    setSaving(true);
    setError("");

    try {
      const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
      const now = Date.now();

      await createDocument(
        COLLECTIONS.documents,
        {
          user_id: user.$id,
          title: title.trim(),
          body,
          word_count: wordCount,
          search_index: buildDocumentSearchIndex(title.trim(), body),
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadOwnerWritePermissions(user.$id),
      );

      router.push("/documents");
    } catch {
      setError("Failed to save document. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Collaborative documents</p>
          <Link href="/documents" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to documents
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: 32 }}>
        <input
          type="text"
          placeholder="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: "100%",
            fontSize: "1.6rem",
            fontWeight: 700,
            border: "none",
            background: "transparent",
            padding: "0 0 16px 0",
            fontFamily: "var(--font-head)",
            outline: "none",
          }}
        />
        <textarea
          placeholder="Start writing your document... Use AI suggestions to improve your content."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{
            width: "100%",
            minHeight: 400,
            border: "none",
            background: "transparent",
            fontSize: "1rem",
            lineHeight: 1.8,
            padding: 0,
            outline: "none",
            resize: "vertical",
          }}
        />
        {error && <p style={{ color: "var(--coral)", fontSize: "0.85rem" }}>{error}</p>}
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <button className="primary" onClick={() => void analyzeDocument()} disabled={!title.trim()}>
            Analyze with AI
          </button>
          <button className="ghost" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving..." : "Save document"}
          </button>
        </div>
      </div>

      <AIPanel
        title={title}
        content={body}
        onApplyTitle={setTitle}
        onApplyContent={setBody}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="card">
          <div className="section-header">
            <h3 style={{ fontFamily: "var(--font-head)" }}>AI suggestions</h3>
            <button className="ghost" onClick={() => setShowSuggestions(false)}>Dismiss</button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {suggestions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background:
                    s.type === "suggestion"
                      ? "rgba(44, 138, 125, 0.08)"
                      : s.type === "rewrite"
                        ? "rgba(244, 184, 96, 0.12)"
                        : "rgba(255, 111, 79, 0.1)",
                  border: "1px solid rgba(16,24,32,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span className="eyebrow" style={{ margin: 0 }}>{s.type}</span>
                  <span className="muted" style={{ fontSize: "0.75rem" }}>{s.context}</span>
                </div>
                <p style={{ fontSize: "0.95rem", lineHeight: 1.5 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
