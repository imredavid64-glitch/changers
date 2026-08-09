"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS } from "@/lib/appwrite/bridge";
import { databases, Query } from "@/lib/appwrite/client";
import { appwriteEnabled, appwriteConfig } from "@/lib/appwrite/config";

const STRANDS = [
  { key: "N", label: "Nature", emoji: "🌿", color: "rgba(44,138,125,0.14)", description: "Climate, conservation, and regeneration projects that restore the natural world." },
  { key: "E", label: "Economy", emoji: "💡", color: "rgba(244,184,96,0.22)", description: "Circular systems, ethical jobs, and fair access to opportunity and resources." },
  { key: "S", label: "Society", emoji: "🤝", color: "rgba(255,111,79,0.14)", description: "Community, inclusion, and justice — building belonging for everyone." },
  { key: "W", label: "Wellbeing", emoji: "🧘", color: "rgba(147,197,253,0.25)", description: "Health, safety, and belonging — for people and the planet alike." },
];

const FEATURE_GROUPS: { title: string; blurb: string; items: { emoji: string; name: string; href: string; desc: string }[] }[] = [
  {
    title: "Connect & collaborate",
    blurb: "A social network designed around doing, not scrolling.",
    items: [
      { emoji: "📣", name: "Home Feed", href: "/posts", desc: "Strand-based posts with polls, likes, and comments — in a chronological feed with no algorithmic rabbit holes." },
      { emoji: "📋", name: "Projects", href: "/projects", desc: "Collaborative project spaces with members, status tracking, and a built-in kanban task board." },
      { emoji: "💬", name: "Co-Lab Rooms", href: "/rooms", desc: "Topic rooms where changemakers gather to swap ideas and coordinate action." },
      { emoji: "🎪", name: "Events", href: "/events", desc: "Host or join changemaker events with one-tap RSVPs — online or in person." },
      { emoji: "🌐", name: "My Network", href: "/network", desc: "Discover fellow changemakers, follow their work, and grow a community around shared strands." },
      { emoji: "🎓", name: "Mentors", href: "/mentors", desc: "Find recognized mentors by focus area and get guidance from experienced leaders." },
      { emoji: "✉️", name: "Messages", href: "/messages", desc: "Private threads for deeper conversations and planning with your collaborators." },
    ],
  },
  {
    title: "Create & build",
    blurb: "A full creative toolbox for turning ideas into real things.",
    items: [
      { emoji: "📄", name: "Documents", href: "/documents", desc: "Persistent writing workspace with live word counts and an AI coach that suggests improvements." },
      { emoji: "📽️", name: "Slideshows", href: "/slideshows", desc: "Presentation builder with templates — pitch your project in minutes." },
      { emoji: "📊", name: "Tables", href: "/tools/tables", desc: "Lightweight data grids for budgets, inventories, and campaign trackers." },
      { emoji: "🧑‍💻", name: "Code Maker", href: "/tools/code", desc: "Save and organize code snippets with syntax highlighting and labels." },
      { emoji: "🎨", name: "Designer", href: "/tools/design", desc: "Canvas-based designer for posters, logos, and campaign visuals." },
      { emoji: "🎬", name: "Film Maker", href: "/tools/films", desc: "Screenplay and storyboard tool for short films and documentary pitches." },
      { emoji: "✅", name: "Task Board", href: "/projects", desc: "Drag projects from idea to done with priorities and assignees." },
    ],
  },
  {
    title: "AI-powered",
    blurb: "An assistant that amplifies you — never takes over.",
    items: [
      { emoji: "🤖", name: "AI Writing Coach", href: "/documents", desc: "Analyzes your document and suggests impact statements, structure, and calls to action." },
      { emoji: "🧭", name: "Outline Generator", href: "/documents/new", desc: "Turns any topic and audience into a structured outline instantly." },
      { emoji: "💡", name: "Project Idea Engine", href: "/projects", desc: "Generates strand-specific project ideas with descriptions — perfect for brainstorming sessions." },
    ],
  },
  {
    title: "Impact & growth",
    blurb: "See your contribution add up — and get recognized for it.",
    items: [
      { emoji: "🏔️", name: "Impact Score", href: "/impact", desc: "Every post, project, and event earns impact points with levels from Beginner to Trailblazer." },
      { emoji: "🏆", name: "Badges", href: "/profile", desc: "30+ achievements for milestones, streaks, community building, and strand leadership." },
      { emoji: "🔔", name: "Notifications", href: "/notifications", desc: "Realtime alerts for likes, comments, follows, and event reminders — plus an email digest." },
      { emoji: "🎨", name: "Profiles", href: "/profile", desc: "Custom themes, mentor focus, and privacy controls that put you in charge." },
      { emoji: "🔎", name: "Search", href: "/search", desc: "Find people, projects, and ideas across the whole community." },
    ],
  },
];

const PRINCIPLES = [
  { emoji: "🧭", title: "Chronological, not algorithmic", desc: "Feeds show what your community actually shares, in order — no engagement-maximizing black boxes." },
  { emoji: "🚫", title: "No infinite scroll", desc: "Feeds have a finite end. When you're done, you're done — go build something." },
  { emoji: "🌱", title: "Built for action", desc: "Every feature leads somewhere: a project, a task, a document, an event. Not just another like." },
];

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const [stats, setStats] = useState({ changemakers: 0, projects: 0, posts: 0 });

  useEffect(() => {
    if (!appwriteEnabled) return;

    let active = true;

    const load = async () => {
      const [profiles, projects, posts] = await Promise.allSettled([
        databases.listDocuments(appwriteConfig.databaseId, COLLECTIONS.profiles, [Query.limit(1)]),
        databases.listDocuments(appwriteConfig.databaseId, COLLECTIONS.projects, [Query.limit(1)]),
        databases.listDocuments(appwriteConfig.databaseId, COLLECTIONS.posts, [Query.limit(1)]),
      ]);

      if (!active) return;

      setStats({
        changemakers: profiles.status === "fulfilled" ? profiles.value.total : 0,
        projects: projects.status === "fulfilled" ? projects.value.total : 0,
        posts: posts.status === "fulfilled" ? posts.value.total : 0,
      });
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--sand)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid var(--teal)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--moss)" }}>Loading Changers...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0faf5, #ecfdf5, #f0fdfa)" }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(16,24,32,0.08)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.5rem" }}>🌿</span>
            <span className="logo">Changers</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/sign-in" className="ghost" style={{ padding: "10px 20px", borderRadius: 999, textDecoration: "none" }}>Sign in</Link>
            <Link href="/sign-up" className="primary" style={{ padding: "10px 24px", borderRadius: 999, textDecoration: "none" }}>Get started</Link>
          </div>
        </div>
      </nav>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(31,94,84,0.1)", color: "var(--moss)", padding: "8px 20px", borderRadius: 999, fontSize: "0.85rem", fontWeight: 600, marginBottom: 32 }}>
          <span>🌱</span>
          <span>A changemaker community for students & young leaders</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", fontFamily: "var(--font-head)", color: "var(--ink)", marginBottom: 24, lineHeight: 1.15 }}>
          Build projects that{" "}
          <span style={{ color: "var(--teal)" }}>change the world</span>
        </h1>
        <p style={{ fontSize: "clamp(1.1rem, 2vw, 1.4rem)", color: "rgba(16,24,32,0.7)", maxWidth: 680, margin: "0 auto 40px", lineHeight: 1.7 }}>
          A collaboration-first platform for changemakers. Share ideas, launch projects,
          use AI-powered creative tools, and watch your impact grow — without addictive feeds.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/sign-up" className="primary" style={{ padding: "16px 40px", borderRadius: 999, fontSize: "1.1rem", textDecoration: "none" }}>
            Start building — it&apos;s free
          </Link>
          <button className="ghost" onClick={() => setShowDemo(!showDemo)} style={{ padding: "16px 40px", borderRadius: 999, fontSize: "1.1rem" }}>
            {showDemo ? "Close" : "See how it works"}
          </button>
        </div>
      </section>

      {showDemo && (
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
          <div className="card" style={{ padding: "40px 48px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "1.5rem", fontFamily: "var(--font-head)", marginBottom: 20 }}>How Changers works</h3>
                {[
                  ["1", "Create your profile", "Pick your strands, role, and what you want to work on."],
                  ["2", "Share or start something", "Post an idea, launch a project, or open a room."],
                  ["3", "Build with the toolbox", "Documents, slideshows, tables, design, film — plus AI help."],
                  ["4", "Track your impact", "Earn impact points and badges as your work takes off."],
                ].map(([num, title, desc]) => (
                  <div key={num} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div style={{ color: "var(--teal)", fontWeight: 700, fontSize: "1.2rem", minWidth: 24 }}>{num}</div>
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--ink)" }}>{title}</p>
                      <p className="muted" style={{ fontSize: "0.9rem" }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: "linear-gradient(135deg, rgba(31,94,84,0.1), rgba(155,199,177,0.15))", borderRadius: 20, padding: 32 }}>
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "1.1rem" }}>Y</div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>Community Garden Project</p>
                      <p className="muted" style={{ fontSize: "0.8rem" }}>Nature strand · 4 members</p>
                    </div>
                  </div>
                  {[
                    ["📄", "Proposal Document", "AI coach: 3 suggestions"],
                    ["🏆", "Impact Score", "245 pts · Changemaker"],
                    ["✅", "Task Board", "6 done · 2 in progress"],
                    ["📽️", "Pitch Slideshow", "8 slides ready"],
                  ].map(([icon, title, meta]) => (
                    <div key={title} style={{ background: "rgba(31,94,84,0.06)", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{icon} {title}</p>
                      <p className="muted" style={{ fontSize: "0.8rem" }}>{meta}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={{ background: "white", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p className="eyebrow">The Impact Compass</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontFamily: "var(--font-head)", color: "var(--ink)", marginBottom: 12 }}>
              Four strands of change
            </h2>
            <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 640, margin: "0 auto" }}>
              Every post, project, and event connects to one of the four sustainability strands
              — mirroring the Sustainability Compass used at the Changemaker Conference.
            </p>
          </div>
          <div className="feature-grid">
            {STRANDS.map((strand) => (
              <div key={strand.key} className="feature" style={{ background: strand.color, borderRadius: 20, padding: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: "2rem" }}>{strand.emoji}</span>
                  <span style={{ fontWeight: 800, fontSize: "1.4rem", color: "var(--moss)" }}>{strand.key}</span>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontFamily: "var(--font-head)", marginBottom: 8 }}>{strand.label}</h3>
                <p className="muted" style={{ lineHeight: 1.7 }}>{strand.description}</p>
                <Link href={`/posts?strand=${strand.key}`} style={{ display: "inline-block", marginTop: 16, color: "var(--teal)", fontWeight: 700, fontSize: "0.9rem" }}>
                  Explore {strand.label} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {FEATURE_GROUPS.map((group) => (
        <section key={group.title} style={{ background: group.title === "AI-powered" ? "linear-gradient(135deg, rgba(31,94,84,0.06), rgba(155,199,177,0.12))" : "var(--sand)", padding: "80px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <p className="eyebrow">{group.title}</p>
              <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 560, margin: "0 auto" }}>{group.blurb}</p>
            </div>
            <div className="feature-grid" style={{ textAlign: "left" }}>
              {group.items.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="feature hover-lift"
                  style={{ display: "block", background: "rgba(255,255,255,0.85)", borderRadius: 20, padding: 28, textDecoration: "none", color: "inherit", border: "1px solid rgba(16,24,32,0.06)" }}
                >
                  <div style={{ fontSize: "2.2rem", marginBottom: 14 }}>{item.emoji}</div>
                  <h3 style={{ fontSize: "1.2rem", fontFamily: "var(--font-head)", marginBottom: 8, color: "var(--ink)" }}>{item.name}</h3>
                  <p className="muted" style={{ lineHeight: 1.7, fontSize: "0.95rem" }}>{item.desc}</p>
                  <span style={{ display: "inline-block", marginTop: 12, color: "var(--teal)", fontWeight: 700, fontSize: "0.85rem" }}>
                    Open {item.name} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section style={{ background: "white", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontFamily: "var(--font-head)", color: "var(--ink)", marginBottom: 12 }}>
            Built for changemakers, not for addiction
          </h2>
          <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 640, margin: "0 auto 48px" }}>
            No ads. No engagement algorithms. No dopamine loops. Just real tools for real change.
          </p>
          <div className="feature-grid" style={{ textAlign: "left" }}>
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="feature" style={{ background: "rgba(31,94,84,0.05)", borderRadius: 20, padding: 32 }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>{principle.emoji}</div>
                <h3 style={{ fontSize: "1.3rem", fontFamily: "var(--font-head)", marginBottom: 8 }}>{principle.title}</h3>
                <p className="muted" style={{ lineHeight: 1.7 }}>{principle.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "linear-gradient(135deg, var(--moss), var(--teal))", padding: "80px 24px", color: "white", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontFamily: "var(--font-head)", marginBottom: 16 }}>
            Join a community that&apos;s building something better
          </h2>
          <p style={{ fontSize: "1.1rem", opacity: 0.9, marginBottom: 40, lineHeight: 1.7 }}>
            Your first post, project, or document takes under a minute. No email verification required.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, maxWidth: 480, margin: "0 auto" }}>
            {[
              ["Active changemakers", stats.changemakers],
              ["Projects launched", stats.projects],
              ["Posts shared", stats.posts],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 24, backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "white", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontFamily: "var(--font-head)", marginBottom: 16 }}>
            Ready to start building?
          </h2>
          <p className="muted" style={{ fontSize: "1.1rem", marginBottom: 32 }}>
            Create your changemaker profile in under a minute. No email verification required.
          </p>
          <Link href="/sign-up" className="primary" style={{ padding: "16px 40px", borderRadius: 999, fontSize: "1.1rem", textDecoration: "none", display: "inline-block" }}>
            Create your account
          </Link>
          <p className="muted" style={{ marginTop: 16, fontSize: "0.9rem" }}>
            Already have one? <Link href="/sign-in" style={{ color: "var(--moss)", fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </section>

      <footer className="footer" style={{ background: "var(--ink)", color: "rgba(255,255,255,0.6)", padding: "48px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: "1.2rem", fontFamily: "var(--font-head)", color: "white", marginBottom: 8 }}>🌿 Changers</p>
              <p style={{ fontSize: "0.85rem" }}>A changemaker community platform. Built for students, by changemakers.</p>
            </div>
            {[
              ["Platform", [["Home Feed", "/posts"], ["Projects", "/projects"], ["Events", "/events"], ["Rooms", "/rooms"], ["Impact", "/impact"]]],
              ["Tools", [["Documents", "/documents"], ["Slideshows", "/slideshows"], ["Tables", "/tools/tables"], ["Code Maker", "/tools/code"], ["Designer", "/tools/design"], ["Film Maker", "/tools/films"]]],
              ["Community", [["Network", "/network"], ["Mentors", "/mentors"], ["Messages", "/messages"], ["Notifications", "/notifications"], ["Search", "/search"]]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <p style={{ color: "white", fontWeight: 600, marginBottom: 12, fontSize: "0.9rem" }}>{title}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(links as [string, string][]).map(([label, href]) => (
                    <Link key={href} href={href} style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>{label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
