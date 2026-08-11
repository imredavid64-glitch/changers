"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocument, updateDocument, deleteDocument } from "@/lib/appwrite/bridge";
import { normalizeDocument, formatRelativeTime } from "@/lib/social/utils";
import { AppDocument } from "@/lib/social/types";
import { AIPanel } from "@/components/AIPanel";

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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [editCount, setEditCount] = useState(0);
  const [isCoEditing, setIsCoEditing] = useState(false);
  const [coEditorName, setCoEditorName] = useState("");
  const lastSavedRef = useRef<{ title: string; body: string }>({ title: "", body: "" });
  const applyingExternalRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime subscription must stay stable for the lifetime of this document view:
  // re-subscribing on every keystroke (title/body change) would tear down and recreate
  // the channel mid-edit. The callback reads the latest values from state and refs.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!user || !id) return;

    const unsub = watchDocument(
      COLLECTIONS.documents,
      id,
      (doc) => normalizeDocument(doc.$id, doc as unknown as Record<string, unknown>),
      (doc) => {
        if (doc) {
          if (!document) {
            setDocument(doc);
            setTitle(doc.title);
            setBody(doc.body);
            lastSavedRef.current = { title: doc.title, body: doc.body };
          } else {
            const localMatches =
              lastSavedRef.current.title === doc.title &&
              lastSavedRef.current.body === doc.body;

            const ourSnapshot =
              title === doc.title && body === doc.body;

            if (!localMatches && !ourSnapshot && !applyingExternalRef.current) {
              applyingExternalRef.current = true;
              setIsCoEditing(true);
              setCoEditorName(doc.user_id === user.$id ? "another device" : "a teammate");
              setTitle(doc.title);
              setBody(doc.body);
              lastSavedRef.current = { title: doc.title, body: doc.body };
              setDirty(false);
              setSaveState("saved");
              setEditCount((c) => c + 1);
              setTimeout(() => {
                applyingExternalRef.current = false;
                setIsCoEditing(false);
              }, 5000);
            }
          }
        }
      },
    );

    return unsub;
  }, [user, id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  function triggerDownload(filename: string, content: string, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(title + "\n\n" + body);
    } catch (e) {
      console.error("Failed to copy document", e);
    }
  }

  function handleDownload() {
    triggerDownload(`${title || "document"}.txt`, title + "\n\n" + body);
  }

  const handleSave = useCallback(async () => {
    if (!title.trim() || !document || !user) return;
    setSaving(true);
    setSaveState("saving");

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
      lastSavedRef.current = { title: title.trim(), body };
      setDirty(false);
      setSaveState("saved");
    } catch (e) {
      console.error("Failed to save document", e);
      setSaveState("idle");
    }
    setSaving(false);
  }, [body, document, title, user]);

  const autosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (dirty && document) {
        void handleSave();
      }
    }, 2500);
  }, [dirty, document, handleSave]);

  function handleTitleChange(value: string) {
    setTitle(value);
    setDirty(true);
    autosave();
  }

  function handleBodyChange(value: string) {
    setBody(value);
    setDirty(true);
    autosave();
  }

  function handleApplyContent(value: string) {
    setBody(value);
    setDirty(true);
  }

  function handleApplyTitle(value: string) {
    setTitle(value);
    setDirty(true);
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isCoEditing && (
            <span className="chip" style={{ background: "rgba(244,184,96,0.2)" }}>
              ✍️ {coEditorName} is editing — changes synced
            </span>
          )}
          {saveState === "saving" && <span className="muted" style={{ fontSize: "0.8rem" }}>Saving…</span>}
          {saveState === "saved" && <span className="muted" style={{ fontSize: "0.8rem" }}>Saved ✓</span>}
          {document.updated_at && (
            <span className="muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>
              Updated {formatRelativeTime(document.updated_at)}
            </span>
          )}
          {dirty && (
            <button className="primary" onClick={() => void handleSave()} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button className="ghost" onClick={handleCopy}>
            Copy
          </button>
          <button className="ghost" onClick={handleDownload}>
            Download .txt
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
          onChange={(e) => handleTitleChange(e.target.value)}
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
          onChange={(e) => handleBodyChange(e.target.value)}
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
        {editCount > 0 && (
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: 12 }}>
            Co-edit history: {editCount} external change{editCount !== 1 ? "s" : ""} applied from teammates.
          </p>
        )}
      </div>

      <AIPanel
        title={title}
        content={body}
        onApplyTitle={handleApplyTitle}
        onApplyContent={handleApplyContent}
      />
    </div>
  );
}
