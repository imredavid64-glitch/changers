"use client";

import { useState } from "react";
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
          <p className="eyebrow">Presentations</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>Slideshows</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Start from a template</h3>
        <div className="feature-grid">
          {templates.map((template: SlideTemplate) => (
            <Link
              key={template.id}
              href={`/slideshows/new?template=${template.id}`}
              className="project-card hover-lift"
              style={{ display: "block", padding: 20, textDecoration: "none" }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>
                {template.id === "project-pitch" ? "🎯" : template.id === "impact-report" ? "📊" : "🔧"}
              </div>
              <h4 style={{ marginBottom: 6 }}>{template.name}</h4>
              <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
                {template.description}
              </p>
              <div style={{ display: "flex", gap: 4 }}>
                {template.slides.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 24,
                      height: 4,
                      borderRadius: 2,
                      background: i < template.slides.length ? "var(--moss)" : "rgba(16,24,32,0.1)",
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--moss)", marginTop: 8 }}>
                {template.slides.length} slides
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <p className="muted">
          Or create a{" "}
          <Link href="/slideshows/new" style={{ color: "var(--moss)", fontWeight: 600 }}>
            blank slideshow
          </Link>
        </p>
      </div>
    </div>
  );
}
