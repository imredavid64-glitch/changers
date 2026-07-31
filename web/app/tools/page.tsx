"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const TOOLS = [
  { href: "/documents", icon: "📝", name: "Documents", desc: "Write and edit documents with AI suggestions" },
  { href: "/slideshows", icon: "📽️", name: "Slideshows", desc: "Create presentations from templates" },
  { href: "/tools/tables", icon: "📊", name: "Tables", desc: "Spreadsheet editor like Excel" },
  { href: "/tools/code", icon: "💻", name: "Code Maker", desc: "Write and save code snippets" },
  { href: "/tools/design", icon: "🎨", name: "Designer", desc: "Canvas with shapes, text, and colors" },
  { href: "/tools/films", icon: "🎬", name: "Film Maker", desc: "Storyboard with scenes and shots" },
];

export default function ToolsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Creative Tools</h1>
          <p className="muted">Sign in to access all tools.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p className="eyebrow">Creative suite</p>
        <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>All Tools</h1>
      </div>

      <div className="feature-grid">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="project-card hover-lift"
            style={{ display: "block", cursor: "pointer", textDecoration: "none", padding: 24 }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>{tool.icon}</div>
            <div className="collab-title" style={{ marginBottom: 6 }}>{tool.name}</div>
            <p className="muted" style={{ fontSize: "0.85rem" }}>{tool.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
