"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, createDocument, publicReadOwnerWritePermissions } from "@/lib/appwrite/bridge";
import { buildCodeSearchIndex } from "@/lib/social/toolSearch";

const LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "HTML", "CSS", "JSON", "SQL", "Bash", "Rust", "Go", "Plain Text",
];

export default function NewCodeSnippetPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("JavaScript");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>New code snippet</h1>
          <p className="muted">Sign in to create code snippets.</p>
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
      const now = Date.now();
      const langValue = language.toLowerCase().replace(/\s+/g, "");

      await createDocument(
        COLLECTIONS.codeSnippets,
        {
          user_id: user.$id,
          title: title.trim(),
          language: langValue,
          code,
          search_index: buildCodeSearchIndex(title.trim(), langValue, code),
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadOwnerWritePermissions(user.$id),
      );

      router.push("/tools/code");
    } catch (e) {
      setError("Failed to save snippet. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Code snippets</p>
          <Link href="/tools/code" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to snippets
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: 32 }}>
        <input
          type="text"
          placeholder="Snippet title"
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
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid rgba(16,24,32,0.1)",
            background: "transparent",
            fontSize: "0.9rem",
            marginBottom: 16,
            outline: "none",
            cursor: "pointer",
          }}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="// Write your code here..."
          style={{
            width: "100%", minHeight: 400,
            fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace",
            fontSize: "0.9rem", lineHeight: 1.6,
            border: "none", background: "#1a1d23", color: "#e4e7eb",
            padding: 20, outline: "none", resize: "vertical", borderRadius: 12,
          }}
        />
        {error && <p style={{ color: "var(--coral)", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button className="ghost" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving..." : "Save snippet"}
          </button>
        </div>
      </div>
    </div>
  );
}
