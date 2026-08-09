"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS } from "@/lib/appwrite/bridge";
import { databases, Query } from "@/lib/appwrite/client";
import { appwriteEnabled, appwriteConfig } from "@/lib/appwrite/config";

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
        <p style={{ fontSize: "clamp(1.1rem, 2vw, 1.4rem)", color: "rgba(16,24,32,0.7)", marginBottom: 40, maxWidth: 640, margin: "0 auto 40px", lineHeight: 1.7 }}>
          A collaboration-first platform for changemakers. Share ideas, build projects, create impact — without addictive feeds.
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
                  ["1", "Create your profile", "Show your interests and what you want to work on."],
                  ["2", "Join or start a Base", "Collaborative project spaces with AI tools."],
                  ["3", "Use AI-powered tools", "Document editor, slideshow maker, research assistant."],
                  ["4", "Track your impact", "See your sustainability metrics and project progress."],
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
                      <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>Your Base</p>
                      <p className="muted" style={{ fontSize: "0.8rem" }}>Climate Action Project</p>
                    </div>
                  </div>
                  {[
                    ["📄", "Project Proposal", "Last edited 2m ago"],
                    ["📊", "Impact Dashboard", "12 kg CO₂ saved this week"],
                    ["💬", "Team Discussion", "4 new messages"],
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
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontFamily: "var(--font-head)", color: "var(--ink)", marginBottom: 12 }}>
            Built for changemakers, not for addiction
          </h2>
          <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 640, margin: "0 auto 48px" }}>
            No infinite scroll. No algorithmic feeds. Just tools to collaborate, create, and track your impact.
          </p>
          <div className="feature-grid" style={{ textAlign: "left" }}>
            {[
              ["🏢", "Bases", "Collaborative project spaces with AI tools, document editing, version control, and real-time team chat."],
              ["🤖", "AI Tools", "Smart assistants that help you write, research, brainstorm, and organize — without taking over."],
              ["🌱", "Impact Tracking", "See your real environmental impact, project progress, and contribution to the community."],
            ].map(([emoji, title, desc]) => (
              <div key={title} className="feature" style={{ background: "rgba(31,94,84,0.05)", borderRadius: 20, padding: 32 }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>{emoji}</div>
                <h3 style={{ fontSize: "1.3rem", fontFamily: "var(--font-head)", marginBottom: 8 }}>{title}</h3>
                <p className="muted" style={{ lineHeight: 1.7 }}>{desc}</p>
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
            No ads. No algorithms. No dopamine loops. Just real tools for real change.
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
            {[["Platform", ["Dashboard", "Projects", "Documents", "Events", "Posts"]], ["Tools", ["Tables", "Slideshows", "Film Maker"]], ["Community", ["Mentors", "Impact", "Rooms"]]].map(([title, links]) => (
              <div key={title as string}>
                <p style={{ color: "white", fontWeight: 600, marginBottom: 12, fontSize: "0.9rem" }}>{title}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(links as string[]).map(link => {
                    const path = `/tools/${link.toLowerCase().replace(/ /g, "-")}`;
                    return (
                      <Link key={link} href={["Tables", "Slideshows", "Film Maker"].includes(link) ? path : `/${link.toLowerCase()}`} style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>{link}</Link>
                    );
                  })}
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
