"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getSlideTemplates, SlideTemplate } from "@/lib/ai/tools";

export default function SlideshowsPage() {
  const { user } = useAuth();
  const templates = getSlideTemplates();

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Slideshows</h1>
          <p className="muted">Sign in to create slideshows with AI-powered templates.</p>
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
          <p className="eyebrow">Presentations</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>Slideshows</h1>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 16 }}>Start from a template</h3>
        <div className="feature-grid">
          {templates.map((template: SlideTemplate) => (
            <Link
              key={template.id}
              href={`/slideshows/new?template=${template.id}`}
              className="project-card hover-lift"
              style={{ display: "block", cursor: "pointer", textDecoration: "none" }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>
                {template.id === "project-pitch" ? "🎯" : template.id === "impact-report" ? "📊" : "🔧"}
              </div>
              <div className="collab-title" style={{ marginBottom: 6 }}>{template.name}</div>
              <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
                {template.description}
              </p>
              <div style={{ display: "flex", gap: 4 }}>
                {template.slides.map((_, i) => (
                  <div key={i} style={{ width: 24, height: 4, borderRadius: 2, background: i < template.slides.length ? "var(--moss)" : "rgba(16,24,32,0.1)" }} />
                ))}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--moss)", marginTop: 8 }}>{template.slides.length} slides</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <p className="muted">
          Or create a{" "}
          <Link href="/slideshows/new" style={{ color: "var(--moss)", fontWeight: 600 }}>blank slideshow</Link>
        </p>
      </div>
    </div>
  );
}
