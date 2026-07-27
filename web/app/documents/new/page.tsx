"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  generateDocumentSuggestions,
  AISuggestion,
} from "@/lib/ai/tools";

export default function NewDocumentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  const analyzeDocument = useCallback(() => {
    const result = generateDocumentSuggestions(title, body);
    setSuggestions(result);
    setShowSuggestions(true);
  }, [title, body]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>New document</h1>
          <p className="muted">Sign in to create documents.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: "12px", borderRadius: 999 }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    router.push("/documents");
  }

  return (
    <div style={{ padding: "24px 0", maxWidth: 800, margin: "0 auto" }}>
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

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <button className="primary" onClick={analyzeDocument} disabled={!title.trim()}>
            Analyze with AI
          </button>
          <button className="ghost" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving..." : "Save document"}
          </button>
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-header">
            <h3>AI suggestions</h3>
            <button className="ghost" onClick={() => setShowSuggestions(false)}>
              Dismiss
            </button>
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
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 1, color: "var(--moss)" }}>
                    {s.type}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--moss)" }}>
                    {s.context}
                  </span>
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
