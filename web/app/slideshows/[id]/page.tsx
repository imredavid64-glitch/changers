"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocument, updateDocument, deleteDocument } from "@/lib/appwrite/bridge";
import { normalizeSlideshow, formatRelativeTime } from "@/lib/social/utils";
import { AppSlideshow } from "@/lib/social/types";

export default function SlideshowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [slideshow, setSlideshow] = useState<AppSlideshow | null>(null);
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<AppSlideshow["slides"]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const unsub = watchDocument(
      COLLECTIONS.slideshows,
      id,
      (doc) => normalizeSlideshow(doc.$id, doc as unknown as Record<string, unknown>),
      (s) => {
        if (s) {
          setSlideshow(s);
          setTitle(s.title);
          setSlides(s.slides);
        }
      },
    );

    return unsub;
  }, [user, id]);

  function updateSlide(index: number, updates: Partial<(typeof slides)[number]>) {
    setSlides(slides.map((slide, i) => (i === index ? { ...slide, ...updates } : slide)));
    setDirty(true);
  }

  function addSlide() {
    setSlides([...slides, { layout: "content", heading: "New Slide", body: "" }]);
    setCurrentSlide(slides.length);
    setDirty(true);
  }

  function removeSlide(index: number) {
    setSlides(slides.filter((_, i) => i !== index));
    if (currentSlide >= slides.length - 1) {
      setCurrentSlide(Math.max(0, slides.length - 2));
    }
    setDirty(true);
  }

  function buildOutline(): string {
    return slides.map((s, i) => `${i + 1}. ${s.heading}\n${s.body}`).join("\n\n");
  }

  function triggerDownload(filename: string, content: string, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    const outline = buildOutline();
    try {
      await navigator.clipboard.writeText(outline);
    } catch (e) {
      console.error("Failed to copy outline", e);
    }
    triggerDownload(`${title || "slideshow"}.md`, outline, "text/markdown");
  }

  async function handleSave() {
    if (!slideshow || !user) return;
    setSaving(true);

    try {
      await updateDocument(
        COLLECTIONS.slideshows,
        slideshow.id,
        {
          title: title.trim(),
          slides_json: JSON.stringify(slides),
          slide_count: slides.length,
          updated_at_ms: Date.now(),
        },
      );
      setDirty(false);
    } catch (e) {
      console.error("Failed to save slideshow", e);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!slideshow) return;
    if (!window.confirm("Delete this slideshow? This cannot be undone.")) return;
    setDeleting(true);

    try {
      await deleteDocument(COLLECTIONS.slideshows, slideshow.id);
      router.push("/slideshows");
    } catch (e) {
      console.error("Failed to delete slideshow", e);
      setDeleting(false);
    }
  }

  const slideBg = slides[currentSlide]?.layout || "content";
  const bgStyle: Record<string, string> = {
    title: "linear-gradient(135deg, var(--moss), var(--teal))",
    content: "white",
    "two-column": "rgba(44, 138, 125, 0.06)",
    image: "rgba(244, 184, 96, 0.1)",
    quote: "rgba(255, 111, 79, 0.08)",
    impact: "linear-gradient(135deg, rgba(44, 138, 125, 0.1), rgba(244, 184, 96, 0.1))",
    cta: "linear-gradient(135deg, var(--coral), var(--sun))",
  };

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Slideshow</h1>
          <p className="muted">Sign in to view and edit slideshows.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!slideshow) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="muted">Loading slideshow...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Slideshow editor</p>
          <Link href="/slideshows" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to slideshows
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {slideshow.updated_at && (
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Updated {formatRelativeTime(slideshow.updated_at)}
            </span>
          )}
          <button className="ghost" onClick={addSlide}>+ Add slide</button>
          <button className="ghost" onClick={handleExport}>Export</button>
          {dirty && (
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button className="ghost" onClick={handleDelete} disabled={deleting} style={{ color: "var(--coral)" }}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 16, alignSelf: "start" }}>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            style={{
              width: "100%", border: "none", background: "transparent",
              fontSize: "1rem", fontWeight: 700, padding: "0 0 12px 0", outline: "none",
            }}
          />
          <div style={{ display: "grid", gap: 6 }}>
            {slides.map((slide, i) => (
              <div
                key={i}
                onClick={() => { setCurrentSlide(i); setEditing(true); }}
                style={{
                  padding: "8px 10px", borderRadius: 10, cursor: "pointer", fontSize: "0.85rem",
                  background: i === currentSlide ? "rgba(44, 138, 125, 0.12)" : "transparent",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <span>{i + 1}. {slide.heading.slice(0, 20)}</span>
                <button onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: "2px 6px" }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {slides.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>🖼️</div>
              <p className="muted">No slides yet</p>
              <button className="primary" onClick={addSlide} style={{ marginTop: 16 }}>
                + Add slide
              </button>
            </div>
          ) : (
            <div>
              <div style={{ background: bgStyle[slideBg] || "white", minHeight: 250, padding: 40, color: (slideBg === "title" || slideBg === "cta") ? "white" : "var(--ink)" }}>
                {editing ? (
                  <div style={{ maxWidth: 600, margin: "0 auto" }}>
                    <select
                      value={slides[currentSlide].layout}
                      onChange={(e) => updateSlide(currentSlide, { layout: e.target.value })}
                      style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(16,24,32,0.15)", width: "100%" }}
                    >
                      {["title", "content", "two-column", "image", "quote", "impact", "cta"].map(l => (
                        <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1).replace("-", " ")}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={slides[currentSlide].heading}
                      onChange={(e) => updateSlide(currentSlide, { heading: e.target.value })}
                      placeholder="Heading"
                      style={{
                        width: "100%", fontSize: "1.4rem", fontWeight: 700,
                        border: "none", background: "rgba(16,24,32,0.05)", padding: 12,
                        borderRadius: 8, marginBottom: 12, outline: "none",
                      }}
                    />
                    <textarea
                      value={slides[currentSlide].body}
                      onChange={(e) => updateSlide(currentSlide, { body: e.target.value })}
                      placeholder="Slide content"
                      style={{
                        width: "100%", minHeight: 120, border: "none",
                        background: "rgba(16,24,32,0.03)", padding: 12,
                        borderRadius: 8, outline: "none", resize: "vertical", fontSize: "1rem",
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <h2 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)", marginBottom: 12 }}>{slides[currentSlide].heading}</h2>
                    <p style={{ fontSize: "1.1rem", lineHeight: 1.6, maxWidth: 500, margin: "0 auto" }}>{slides[currentSlide].body}</p>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: 16, borderTop: "1px solid rgba(16,24,32,0.08)" }}>
                <button className="ghost" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                  ← Previous
                </button>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>{currentSlide + 1} / {slides.length}</span>
                  <button className="ghost" onClick={() => setEditing(!editing)} style={{ fontSize: "0.85rem" }}>
                    {editing ? "Preview" : "Edit"}
                  </button>
                </div>
                <button className="ghost" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
