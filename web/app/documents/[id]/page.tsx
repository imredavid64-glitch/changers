"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocument, updateDocument, deleteDocument } from "@/lib/appwrite/bridge";
import { normalizeDocument, formatRelativeTime } from "@/lib/social/utils";
import { AppDocument } from "@/lib/social/types";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [document, setDocument] = useState<AppDocument | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const unsub = watchDocument(
      COLLECTIONS.documents,
      id,
      (doc) => normalizeDocument(doc.$id, doc as unknown as Record<string, unknown>),
      (doc) => {
        if (doc) {
          setDocument(doc);
          setTitle(doc.title);
          setBody(doc.body);
        }
      },
    );

    return unsub;
  }, [user, id]);

  async function handleSave() {
    if (!title.trim() || !document || !user) return;
    setSaving(true);

    try {
      const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
      await updateDocument(
        COLLECTIONS.documents,
        document.id,
        {
          title: title.trim(),
          body,
          word_count: wordCount,
          updated_at_ms: Date.now(),
        },
      );
      setDirty(false);
    } catch (e) {
      console.error("Failed to save document", e);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!document || !user) return;
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    setDeleting(true);

    try {
      await deleteDocument(COLLECTIONS.documents, document.id);
      router.push("/documents");
    } catch (e) {
      console.error("Failed to delete document", e);
      setDeleting(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Document</h1>
          <p className="muted">Sign in to view and edit documents.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="muted">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Document</p>
          <Link href="/documents" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to documents
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {document.updated_at && (
            <span className="muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>
              Updated {formatRelativeTime(document.updated_at)}
            </span>
          )}
          {dirty && (
            <button className="primary" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
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
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setDirty(true); }}
          style={{
            width: "100%",
            minHeight: 500,
            border: "none",
            background: "transparent",
            fontSize: "1rem",
            lineHeight: 1.8,
            padding: 0,
            outline: "none",
            resize: "vertical",
          }}
        />
      </div>
    </div>
  );
}
