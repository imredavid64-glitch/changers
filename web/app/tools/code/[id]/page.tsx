"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocument, updateDocument, deleteDocument } from "@/lib/appwrite/bridge";
import { normalizeCodeSnippet, formatRelativeTime } from "@/lib/social/utils";
import { AppCodeSnippet } from "@/lib/social/types";

const LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "HTML", "CSS", "JSON", "SQL", "Bash", "Rust", "Go", "Plain Text",
];

function normalizeLanguage(lang: string): string {
  const map: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    sql: "SQL",
    bash: "Bash",
    rust: "Rust",
    go: "Go",
    plaintext: "Plain Text",
  };
  return map[lang] || lang;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error("Failed to copy", e);
    return false;
  }
}

export default function CodeSnippetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [snippet, setSnippet] = useState<AppCodeSnippet | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("JavaScript");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const unsub = watchDocument(
      COLLECTIONS.codeSnippets,
      id,
      (doc) => normalizeCodeSnippet(doc.$id, doc as unknown as Record<string, unknown>),
      (doc) => {
        if (doc) {
          setSnippet(doc);
          setTitle(doc.title);
          setLanguage(normalizeLanguage(doc.language));
          setCode(doc.code);
        }
      },
    );

    return unsub;
  }, [user, id]);

  async function handleSave() {
    if (!title.trim() || !snippet || !user) return;
    setSaving(true);

    try {
      const langValue = language.toLowerCase().replace(/\s+/g, "");
      await updateDocument(
        COLLECTIONS.codeSnippets,
        snippet.id,
        {
          title: title.trim(),
          language: langValue,
          code,
          updated_at_ms: Date.now(),
        },
      );
      setDirty(false);
    } catch (e) {
      console.error("Failed to save snippet", e);
    }
    setSaving(false);
  }

  async function handleCopyCode() {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function handleDelete() {
    if (!snippet || !user) return;
    if (!window.confirm("Delete this snippet? This cannot be undone.")) return;
    setDeleting(true);

    try {
      await deleteDocument(COLLECTIONS.codeSnippets, snippet.id);
      router.push("/tools/code");
    } catch (e) {
      console.error("Failed to delete snippet", e);
      setDeleting(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Code Snippet</h1>
          <p className="muted">Sign in to view and edit code snippets.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!snippet) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="muted">Loading snippet...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Code snippet</p>
          <Link href="/tools/code" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to snippets
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {snippet.updated_at && (
            <span className="muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>
              Updated {formatRelativeTime(snippet.updated_at)}
            </span>
          )}
          {dirty && (
            <button className="primary" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button className="ghost" onClick={handleCopyCode}>
            {copied ? "Copied!" : "Copy code"}
          </button>
          <button className="ghost" onClick={handleDelete} disabled={deleting} style={{ color: "var(--coral)" }}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 32 }}>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
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
          onChange={(e) => { setLanguage(e.target.value); setDirty(true); }}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid var(--surface-track)",
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
          onChange={(e) => { setCode(e.target.value); setDirty(true); }}
          placeholder="// Write your code here..."
          style={{
            width: "100%", minHeight: 400,
            fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace",
            fontSize: "0.9rem", lineHeight: 1.6,
            border: "none", background: "#1a1d23", color: "#e4e7eb",
            padding: 20, outline: "none", resize: "vertical", borderRadius: 12,
          }}
        />
      </div>
    </div>
  );
}
