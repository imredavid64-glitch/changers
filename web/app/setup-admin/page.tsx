"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function SetupAdminPage() {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleMakeAdmin() {
    if (!user) return;
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/setup-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id, email: user.email }),
      });

      const data = await response.json();
      if (response.ok) {
        setStatus("Admin access granted! You may need to refresh.");
      } else {
        setStatus(data.error || "Failed to set admin.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Setup Admin</h1>

        {!user ? (
          <>
            <p className="muted">Sign in first to set up admin access.</p>
            <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
              Sign in
            </Link>
          </>
        ) : profile?.is_admin ? (
          <>
            <p style={{ fontSize: "2rem", textAlign: "center", marginBottom: 8 }}>✅</p>
            <p className="muted">
              <strong>{profile.full_name}</strong> already has admin access.
            </p>
            <Link href="/admin" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
              Go to Admin Dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="muted">
              Click below to grant admin access to <strong>{user.name}</strong>.
            </p>
            {status && <p className="notice">{status}</p>}
            <button className="primary" onClick={handleMakeAdmin} disabled={loading} style={{ width: "100%", padding: 12 }}>
              {loading ? "Setting up..." : "Make me admin"}
            </button>
          </>
        )}

        <p className="muted" style={{ textAlign: "center" }}>
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
