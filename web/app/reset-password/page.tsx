"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { account } from "@/lib/appwrite/client";
import { PASSWORD_HINT, validatePassword } from "@/lib/auth/password";
import { TINTS } from "@/lib/theme/tints";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const secret = searchParams.get("secret") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!userId || !secret) {
      setStatus("This reset link is invalid or has expired. Request a new one below.");
      setStatusKind("error");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setStatus(passwordError);
      setStatusKind("error");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      setStatusKind("error");
      return;
    }

    setLoading(true);
    try {
      await account.updateRecovery(userId, secret, password, password);
      setPassword("");
      setConfirmPassword("");
      setStatus("Password updated. You can now sign in with your new password.");
      setStatusKind("success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Password reset failed. The link may have expired.",
      );
      setStatusKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <p className="eyebrow">Changers</p>
          <h1>Reset password</h1>
          <p className="muted">Choose a new password for your account.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
              required
            />
          </label>
          <p className="muted" style={{ fontSize: "0.85rem" }}>{PASSWORD_HINT}</p>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </button>
          {status && (
            <p className="notice" style={{ ...(statusKind === "success" ? { background: TINTS.teal12, color: "var(--moss)" } : {}) }}>
              {status}
            </p>
          )}
        </form>
        <p className="muted">
          {statusKind === "success" ? (
            <>Done? <Link href="/sign-in">Sign in</Link></>
          ) : (
            <>
              Link expired? <Link href="/forgot-password">Request a new one</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="auth-card">
            <p className="muted">Loading…</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}