"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getTemplateById, generateSlideContent, SlideDefinition } from "@/lib/ai/tools";
import { COLLECTIONS, createDocument, publicReadOwnerWritePermissions } from "@/lib/appwrite/bridge";
import { buildSlideshowSearchIndex } from "@/lib/social/toolSearch";
import { TINTS } from "@/lib/theme/tints";

export default function NewSlideshowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<SlideDefinition[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Apply the ?template= preset when it first appears (sentinel forces the mount
  // case) and when it changes to another preset — never on later user edits.
  const [prevTemplateId, setPrevTemplateId] = useState<string | null>("__init__");
  if (templateId !== prevTemplateId) {
    setPrevTemplateId(templateId);
    const template = templateId ? getTemplateById(templateId) : null;
    if (template && templateId) {
      setTitle(template.name);
      const { slides: initialSlides } = generateSlideContent(templateId);
      setSlides(initialSlides);
    }
  }

  function addSlide() {
    setSlides([...slides, { layout: "content", heading: "New Slide", body: "" }]);
    setCurrentSlide(slides.length);
  }

  function updateSlide(index: number, updates: Partial<SlideDefinition>) {
    setSlides(slides.map((slide, i) => (i === index ? { ...slide, ...updates } : slide)));
  }

  function removeSlide(index: number) {
    setSlides(slides.filter((_, i) => i !== index));
    if (currentSlide >= slides.length - 1) {
      setCurrentSlide(Math.max(0, slides.length - 2));
    }
  }

  async function handleSave() {
    if (!title.trim() || slides.length === 0 || !user) return;
    setSaving(true);
    setError("");

    try {
      const now = Date.now();
      await createDocument(
        COLLECTIONS.slideshows,
        {
          user_id: user.$id,
          title: title.trim(),
          template_id: templateId || "",
          slides_json: JSON.stringify(slides),
          slide_count: slides.length,
          search_index: buildSlideshowSearchIndex(title.trim(), slides),
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadOwnerWritePermissions(user.$id),
      );

      router.push("/slideshows");
    } catch {
      setError("Failed to save slideshow. Please try again.");
      setSaving(false);
    }
  }

  const slideBg = slides[currentSlide]?.layout || "content";
  const bgStyle: Record<string, string> = {
    title: "linear-gradient(135deg, var(--moss), var(--teal))",
    content: "var(--surface-card-solid)",
    "two-column": TINTS.teal6,
    image: TINTS.sun10,
    quote: TINTS.coral8,
    impact: "linear-gradient(135deg, color-mix(in srgb, var(--teal) 10%, transparent), color-mix(in srgb, var(--sun) 10%, transparent))",
    cta: "linear-gradient(135deg, var(--coral), var(--sun))",
  };

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>New slideshow</h1>
          <p className="muted">Sign in to create slideshows.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
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
            ← Back to templates
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost" onClick={addSlide}>+ Add slide</button>
          <button className="primary" onClick={handleSave} disabled={saving || slides.length === 0}>
            {saving ? "Saving..." : "Save slideshow"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "var(--coral)", fontSize: "0.85rem" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 16, alignSelf: "start" }}>
          <input
            type="text"
            placeholder="Slideshow title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
                  background: i === currentSlide ? TINTS.teal12 : "transparent",
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
              <p className="muted">Add your first slide to get started</p>
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
                      onChange={(e) => updateSlide(currentSlide, { layout: e.target.value as SlideDefinition["layout"] })}
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
