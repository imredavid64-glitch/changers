"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  getTemplateById,
  generateSlideContent,
  SlideDefinition,
} from "@/lib/ai/tools";

export default function NewSlideshowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<SlideDefinition[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (templateId) {
      const template = getTemplateById(templateId);
      if (template) {
        setTitle(template.name);
        const { slides: initialSlides } = generateSlideContent(templateId);
        setSlides(initialSlides);
      }
    }
  }, [templateId]);

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

  const slideStyles: Record<string, React.CSSProperties> = {
    title: { background: "linear-gradient(135deg, var(--moss), var(--teal))", color: "white", minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 40, textAlign: "center" },
    content: { background: "white", minHeight: 200, padding: 32 },
    "two-column": { background: "rgba(44, 138, 125, 0.06)", minHeight: 200, padding: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
    image: { background: "rgba(244, 184, 96, 0.1)", minHeight: 250, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
    quote: { background: "rgba(255, 111, 79, 0.08)", minHeight: 200, padding: 40, display: "flex", flexDirection: "column", justifyContent: "center", fontStyle: "italic" },
    impact: { background: "linear-gradient(135deg, rgba(44, 138, 125, 0.1), rgba(244, 184, 96, 0.1))", minHeight: 200, padding: 32 },
    cta: { background: "linear-gradient(135deg, var(--coral), var(--sun))", color: "var(--ink)", minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 40, textAlign: "center" },
  };

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>New slideshow</h1>
          <p className="muted">Sign in to create slideshows.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: "12px", borderRadius: 999 }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 0" }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Slideshow editor</p>
          <Link href="/slideshows" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to templates
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost" onClick={addSlide}>
            + Add slide
          </button>
          <button
            className="primary"
            onClick={async () => {
              await new Promise((r) => setTimeout(r, 300));
              router.push("/slideshows");
            }}
          >
            Save slideshow
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 16, alignSelf: "start" }}>
          <input
            type="text"
            placeholder="Slideshow title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              fontSize: "1rem",
              fontWeight: 700,
              padding: "0 0 12px 0",
              outline: "none",
            }}
          />
          <div style={{ display: "grid", gap: 6 }}>
            {slides.map((slide, i) => (
              <div
                key={i}
                onClick={() => { setCurrentSlide(i); setEditing(true); }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  background: i === currentSlide ? "rgba(44, 138, 125, 0.12)" : "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  {i + 1}. {slide.heading.slice(0, 20)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(16,24,32,0.4)",
                    fontSize: "0.8rem",
                    padding: "2px 6px",
                  }}
                >
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
              <div style={slideStyles[slides[currentSlide]?.layout] || slideStyles.content}>
                {editing ? (
                  <div style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
                    <select
                      value={slides[currentSlide].layout}
                      onChange={(e) => updateSlide(currentSlide, { layout: e.target.value as SlideDefinition["layout"] })}
                      style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(16,24,32,0.15)" }}
                    >
                      <option value="title">Title</option>
                      <option value="content">Content</option>
                      <option value="two-column">Two Column</option>
                      <option value="image">Image</option>
                      <option value="quote">Quote</option>
                      <option value="impact">Impact</option>
                      <option value="cta">Call to Action</option>
                    </select>
                    <input
                      type="text"
                      value={slides[currentSlide].heading}
                      onChange={(e) => updateSlide(currentSlide, { heading: e.target.value })}
                      placeholder="Heading"
                      style={{
                        width: "100%",
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        border: "none",
                        background: slides[currentSlide].layout === "title" || slides[currentSlide].layout === "cta" ? "rgba(255,255,255,0.2)" : "rgba(16,24,32,0.05)",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 12,
                        outline: "none",
                      }}
                    />
                    <textarea
                      value={slides[currentSlide].body}
                      onChange={(e) => updateSlide(currentSlide, { body: e.target.value })}
                      placeholder="Slide content"
                      style={{
                        width: "100%",
                        minHeight: 120,
                        border: "none",
                        background: slides[currentSlide].layout === "title" || slides[currentSlide].layout === "cta" ? "rgba(255,255,255,0.15)" : "rgba(16,24,32,0.03)",
                        padding: 12,
                        borderRadius: 8,
                        outline: "none",
                        resize: "vertical",
                        fontSize: "1rem",
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: "center", width: "100%" }}>
                    <h2 style={{ fontSize: "1.8rem", marginBottom: 12 }}>{slides[currentSlide].heading}</h2>
                    <p style={{ fontSize: "1.1rem", lineHeight: 1.6, maxWidth: 500, margin: "0 auto" }}>
                      {slides[currentSlide].body}
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: 16, borderTop: "1px solid rgba(16,24,32,0.08)" }}>
                <button
                  className="ghost"
                  onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                  disabled={currentSlide === 0}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
                  {currentSlide + 1} / {slides.length}
                  <button
                    className="ghost"
                    onClick={() => setEditing(!editing)}
                    style={{ marginLeft: 12, fontSize: "0.8rem" }}
                  >
                    {editing ? "Preview" : "Edit"}
                  </button>
                </span>
                <button
                  className="ghost"
                  onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                  disabled={currentSlide === slides.length - 1}
                >
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
