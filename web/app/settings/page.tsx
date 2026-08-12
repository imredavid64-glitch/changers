"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, KeyRound, LogOut, Settings, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { account } from "@/lib/appwrite/client";
import { getDisplayName } from "@/lib/social/utils";
import { TINTS } from "@/lib/theme/tints";

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error">("success");
  const [changing, setChanging] = useState(false);

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    if (newPassword.length < 8) {
      setStatus("New password must be at least 8 characters.");
      setStatusKind("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("New passwords do not match.");
      setStatusKind("error");
      return;
    }

    setChanging(true);
    setStatus(null);

    try {
      await account.updatePassword(newPassword, currentPassword || undefined);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("Password updated. Use it next time you sign in.");
      setStatusKind("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Password change failed. Check your current password.");
      setStatusKind("error");
    } finally {
      setChanging(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Settings</h1>
          <p className="muted">Sign in to manage your account settings.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const links = [
    {
      href: `/profile/${user.$id}`,
      icon: <UserRound size={18} />,
      title: "Edit profile",
      description: "Bio, headline, strands, avatar, mentor presence, and profile theme.",
    },
    {
      href: "/notifications",
      icon: <Settings size={18} />,
      title: "Notification settings",
      description: "In-app, push, and email digest preferences.",
    },
    {
      href: "/privacy",
      icon: <ShieldCheck size={18} />,
      title: "Privacy & data",
      description: "Profile visibility, message permissions, download a copy of your data, or delete your account.",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: "grid", gap: 24 }}
    >
      <section className="card">
        <div className="section-header">
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Settings size={24} style={{ color: "var(--moss)" }} /> Account settings
            </h2>
            <p className="muted">
              Signed in as <strong>{profile?.full_name || getDisplayName(user)}</strong> ({user.email})
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="card hover-lift"
              style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit", padding: "16px 18px", border: "1px solid var(--border-card)" }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 12, background: TINTS.teal10, color: "var(--moss)", display: "grid", placeItems: "center" }}>
                {link.icon}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700 }}>{link.title}</p>
                <p className="muted" style={{ fontSize: "0.85rem" }}>{link.description}</p>
              </div>
              <span style={{ color: "var(--moss)", fontWeight: 700 }}>→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-head)" }}>
              <KeyRound size={20} style={{ color: "var(--moss)" }} /> Change password
            </h3>
            <p className="muted">Use a unique password — at least 8 characters.</p>
          </div>
        </div>

        <form className="composer-form" onSubmit={handleChangePassword} style={{ maxWidth: 480 }}>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          {status && (
            <p className="notice" style={{ ...(statusKind === "success" ? { background: TINTS.teal12, color: "var(--moss)" } : {}) }}>
              {status}
            </p>
          )}
          <div className="button-row" style={{ justifyContent: "flex-end" }}>
            <button type="submit" className="primary" disabled={changing}>
              {changing ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: TINTS.coral10, color: "var(--coral)", display: "grid", placeItems: "center" }}>
              <Trash2 size={18} />
            </span>
            <div>
              <p style={{ fontWeight: 700 }}>Delete or download your data</p>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Export a copy of everything you have created, or permanently erase your account and content.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/privacy" className="ghost" style={{ textDecoration: "none", padding: "10px 16px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Download size={16} /> Export / Delete
            </Link>
            <button className="ghost" onClick={signOut} style={{ color: "var(--coral)", padding: "10px 16px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
