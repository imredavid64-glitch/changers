"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, countDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { computeImpactScore, impactLevel } from "@/lib/social/impact";
import { refreshBadges } from "@/lib/badges/refresh";

interface DashboardStats {
  projects: number;
  documents: number;
  posts: number;
  slideshows: number;
  followers: number;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ projects: 0, documents: 0, posts: 0, slideshows: 0, followers: 0 });

  useEffect(() => {
    if (!user) return;
    const userId = user.$id;
    let cancelled = false;

    async function loadStats() {
      const results = await Promise.allSettled([
        countDocuments(COLLECTIONS.projects, [Query.equal("owner_id", userId)]),
        countDocuments(COLLECTIONS.documents, [Query.equal("user_id", userId)]),
        countDocuments(COLLECTIONS.posts, [Query.equal("author_id", userId)]),
        countDocuments(COLLECTIONS.slideshows, [Query.equal("user_id", userId)]),
        countDocuments(COLLECTIONS.follows, [Query.equal("followee_id", userId)]),
      ]);

      const count = (result: PromiseSettledResult<number>, key: keyof DashboardStats) => {
        if (!cancelled && result.status === "fulfilled") {
          setStats((prev) => ({ ...prev, [key]: result.value }));
        }
      };

      count(results[0], "projects");
      count(results[1], "documents");
      count(results[2], "posts");
      count(results[3], "slideshows");
      count(results[4], "followers");
    }

    void loadStats();
    void refreshBadges(userId);
    return () => { cancelled = true; };
  }, [user]);

  const impactScore = computeImpactScore({
    posts: stats.posts,
    projects: stats.projects,
    documents: stats.documents,
    slideshows: stats.slideshows,
    eventsHosted: 0,
    roomsJoined: 0,
    followers: stats.followers,
  });
  const level = impactLevel(impactScore);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Dashboard</h1>
          <p className="muted">Sign in to view your dashboard.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="card hero" style={{ padding: 32 }}>
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
              <p className="meta-value">{stats.projects}</p>
            </div>
            <div>
              <p className="meta-label">Posts</p>
              <p className="meta-value">{stats.posts}</p>
            </div>
            <div>
              <p className="meta-label">Documents</p>
              <p className="meta-value">{stats.documents}</p>
            </div>
            <div>
              <p className="meta-label">Slideshows</p>
              <p className="meta-value">{stats.slideshows}</p>
            </div>
            <div>
              <p className="meta-label">Impact score</p>
              <p className="meta-value">{impactScore}</p>
            </div>
            <div>
              <p className="meta-label">Level</p>
              <p className="meta-value" style={{ fontSize: "0.9rem" }}>{level}</p>
            </div>
          </div>
        </div>
      </div>

      <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 8 }}>Quick access</h3>
      <div className="feature-grid" style={{ marginBottom: 16 }}>
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="collab-card hover-lift"
            style={{ textDecoration: "none", display: "block" }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>{link.emoji}</div>
            <div className="collab-title">{link.label}</div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--teal) 8%, transparent), color-mix(in srgb, var(--sun) 8%, transparent))" }}>
        <h3 style={{ marginBottom: 8, fontFamily: "var(--font-head)" }}>🌱 Your changemaker journey</h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          Start by creating a project, joining a room, or writing your first document.
        </p>
        <div className="hero-actions">
          <Link href="/projects" className="primary" style={{ padding: "10px 20px", borderRadius: 999, textDecoration: "none" }}>
            Browse projects
          </Link>
          <Link href="/documents/new" className="ghost" style={{ padding: "10px 20px", borderRadius: 999, textDecoration: "none" }}>
            Write a document
          </Link>
          <Link href="/rooms" className="ghost" style={{ padding: "10px 20px", borderRadius: 999, textDecoration: "none" }}>
            Find a room
          </Link>
        </div>
      </div>
    </div>
  );
}
