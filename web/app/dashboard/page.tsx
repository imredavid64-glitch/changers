"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function DashboardPage() {
  const { user, profile } = useAuth();

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Dashboard</h1>
          <p className="muted">Sign in to view your dashboard.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: "12px", borderRadius: 999 }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const quickLinks = [
    { href: "/projects", label: "Projects", emoji: "📋" },
    { href: "/documents", label: "Documents", emoji: "📄" },
    { href: "/slideshows", label: "Slideshows", emoji: "🖼️" },
    { href: "/rooms", label: "Co-Lab Rooms", emoji: "🏢" },
    { href: "/events", label: "Events", emoji: "📅" },
    { href: "/mentors", label: "Mentors", emoji: "👥" },
    { href: "/impact", label: "Impact", emoji: "🌱" },
    { href: "/messages", label: "Messages", emoji: "💬" },
  ];

  return (
    <div style={{ padding: "24px 0" }}>
      <div className="card hero" style={{ marginBottom: 24 }}>
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1 style={{ fontFamily: "var(--font-head)" }}>
            {profile?.full_name || user.name || "Changemaker"}
          </h1>
          <p className="muted" style={{ margin: "8px 0 16px" }}>
            {profile?.headline || profile?.role || "Building a better world"}
          </p>
          <div className="hero-meta">
            <div>
              <p className="meta-label">Projects</p>
              <p className="meta-value">0</p>
            </div>
            <div>
              <p className="meta-label">Documents</p>
              <p className="meta-value">0</p>
            </div>
            <div>
              <p className="meta-label">Impact</p>
              <p className="meta-value">Just starting</p>
            </div>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: 16, fontFamily: "var(--font-head)" }}>Quick access</h3>
      <div className="feature-grid" style={{ marginBottom: 32 }}>
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="collab-card hover-lift"
            style={{ textDecoration: "none" }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>{link.emoji}</div>
            <h4 style={{ fontSize: "1rem" }}>{link.label}</h4>
          </Link>
        ))}
      </div>

      <div className="card" style={{ background: "linear-gradient(135deg, rgba(44,138,125,0.08), rgba(244,184,96,0.08))" }}>
        <h3 style={{ marginBottom: 8 }}>🌱 Your changemaker journey</h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          Start by creating a project, joining a room, or writing your first document.
        </p>
        <div className="hero-actions">
          <Link href="/projects" className="primary" style={{ padding: "10px 20px", borderRadius: 999 }}>
            Browse projects
          </Link>
          <Link href="/documents/new" className="ghost" style={{ padding: "10px 20px", borderRadius: 999 }}>
            Write a document
          </Link>
          <Link href="/rooms" className="ghost" style={{ padding: "10px 20px", borderRadius: 999 }}>
            Find a room
          </Link>
        </div>
      </div>
    </div>
  );
}
