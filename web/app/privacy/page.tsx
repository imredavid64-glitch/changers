"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Trash2, ShieldCheck, FileText } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { downloadMyData, deleteMyData } from "@/lib/userdata/client";

const COLLECTION_GROUPS: { title: string; icon: string; items: string[] }[] = [
  {
    title: "Account & profile",
    icon: "👤",
    items: [
      "Your name, email, role, headline, bio, location, and profile photo",
      "Preferences like your strands, theme, and privacy settings",
    ],
  },
  {
    title: "Content you create",
    icon: "📝",
    items: [
      "Posts, comments, projects, and rooms you start or join",
      "Documents, slideshows, tables, code snippets, designs, and films",
      "Events you host and RSVPs you make",
    ],
  },
  {
    title: "Social activity",
    icon: "🤝",
    items: [
      "Likes, saves, follows, and blocks",
      "Notifications we send you and your notifications to others",
    ],
  },
  {
    title: "Contact messages",
    icon: "✉️",
    items: [
      "Your name, email, organization, subject, and message from the contact form",
      "Your consent flag, the page you were on, IP address, browser, and referrer",
    ],
  },
  {
    title: "Media uploads",
    icon: "🖼️",
    items: ["Images and videos you upload (file type, size, and storage metadata)"],
  },
  {
    title: "Technical data",
    icon: "🛠️",
    items: [
      "IP address, browser type, and referring page — used to keep the platform safe and to debug issues",
    ],
  },
];

export default function PrivacyPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function handleExport() {
    setStatus(null);
    setBusy("export");
    try {
      await downloadMyData();
      setStatus({ kind: "success", text: "Your data export is being downloaded." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Export failed. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    setStatus(null);
    setBusy("delete");
    try {
      await deleteMyData();
      setStatus({ kind: "success", text: "Your data has been deleted. Signing you out..." });
      await signOut();
      router.push("/");
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Delete failed. Please try again." });
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 64px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <p className="eyebrow">Privacy</p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontFamily: "var(--font-head)", color: "var(--ink)", marginBottom: 12 }}>
          Your data, on your terms
        </h1>
        <p className="muted" style={{ fontSize: "1.05rem", maxWidth: 640, margin: "0 auto", lineHeight: 1.7 }}>
          Changers collects only what it needs to run the platform — and gives you the tools to see it,
          download it, or delete it. This page explains what we collect and why.
        </p>
      </div>

      <section className="card" style={{ padding: "32px 40px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <FileText size={22} style={{ color: "var(--moss)" }} />
          <h2 style={{ fontSize: "1.3rem", fontFamily: "var(--font-head)", color: "var(--ink)" }}>What we collect</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {COLLECTION_GROUPS.map((group) => (
            <div key={group.title} style={{ background: "rgba(31,94,84,0.05)", borderRadius: 16, padding: 20 }}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>{group.icon} {group.title}</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: "0.9rem", color: "rgba(16,24,32,0.8)", lineHeight: 1.6 }}>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: "32px 40px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <ShieldCheck size={22} style={{ color: "var(--moss)" }} />
          <h2 style={{ fontSize: "1.3rem", fontFamily: "var(--font-head)", color: "var(--ink)" }}>How we use and protect it</h2>
        </div>
        <div style={{ display: "grid", gap: 12, fontSize: "0.95rem", color: "rgba(16,24,32,0.85)", lineHeight: 1.7 }}>
          <p style={{ margin: 0 }}>
            <strong>Why we collect it:</strong> to run your account, show you your content, let others find and
            collaborate with you, reply to contact messages, and keep the platform safe from abuse and spam.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Who we share it with:</strong> only the hosting providers that make the platform work — Appwrite
            Cloud (accounts and content) and the database that stores media metadata and contact messages. We never
            sell your data and never show ads.
          </p>
          <p style={{ margin: 0 }}>
            <strong>How long we keep it:</strong> for as long as your account exists, or until you ask us to delete it.
            Contact messages are kept until you delete them or request removal.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Contact submissions:</strong> when you use the{" "}
            <Link href="/contact" style={{ color: "var(--teal)", fontWeight: 600 }}>contact form</Link>, we store your
            name, email, organization, message, and basic technical details (page, IP, browser) so the team can reply
            — only after you tick the consent box.
          </p>
        </div>
      </section>

      <section className="card" style={{ padding: "32px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Download size={22} style={{ color: "var(--moss)" }} />
          <h2 style={{ fontSize: "1.3rem", fontFamily: "var(--font-head)", color: "var(--ink)" }}>Your data, in your hands</h2>
        </div>
        <p className="muted" style={{ fontSize: "0.95rem", marginBottom: 20, lineHeight: 1.6 }}>
          {user
            ? "Download a JSON copy of everything we hold about you, or permanently delete your data and account."
            : "Sign in to download a copy of your data or delete your account."}
        </p>

        {user ? (
          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between", background: "rgba(31,94,84,0.05)", borderRadius: 16, padding: 20 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <p style={{ fontWeight: 700 }}>Export my data</p>
                <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
                  Your profile, posts, comments, projects, documents, media metadata, contact messages, and more — as a JSON file.
                </p>
              </div>
              <button className="primary" onClick={handleExport} disabled={busy !== null} style={{ padding: "12px 24px", borderRadius: 999 }}>
                {busy === "export" ? "Preparing..." : "Download my data"}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between", background: "rgba(255,111,79,0.06)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,111,79,0.15)" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <p style={{ fontWeight: 700, color: "var(--coral)" }}>Delete my data</p>
                <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
                  Permanently deletes your profile, posts, comments, projects, rooms, media, contact messages, and
                  your account. This cannot be undone.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,111,79,0.4)", background: "var(--surface-card-solid)", fontSize: "0.9rem" }}
                />
                <button
                  className="ghost"
                  onClick={handleDelete}
                  disabled={confirmText !== "DELETE" || busy !== null}
                  style={{ padding: "12px 24px", borderRadius: 999, color: "var(--coral)", borderColor: "rgba(255,111,79,0.35)", fontWeight: 600 }}
                >
                  <Trash2 size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                  {busy === "delete" ? "Deleting..." : "Delete everything"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <Link href="/sign-in" className="primary" style={{ textDecoration: "none", display: "inline-block", padding: "12px 24px", borderRadius: 999 }}>
            Sign in to manage your data
          </Link>
        )}

        {status && (
          <p className="notice" style={{ margin: "16px 0 0", ...(status.kind === "success" ? { background: "rgba(44,138,125,0.12)", color: "var(--moss)" } : {}) }}>
            {status.text}
          </p>
        )}
      </section>

      <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center", marginTop: 32, lineHeight: 1.7 }}>
        Questions about your data? <Link href="/contact" style={{ color: "var(--teal)", fontWeight: 600 }}>Contact the team</Link> —
        we reply to every message.
      </p>
    </div>
  );
}
