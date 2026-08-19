"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { account } from "@/lib/appwrite/client";
import { useAuth } from "@/components/AuthProvider";
import { TINTS } from "@/lib/theme/tints";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const secret = searchParams.get("secret") || "";
  const { user, refreshAuth } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current || !userId || !secret) return;
    attemptedRef.current = true;
    setLoading(true);
    (async () => {
      try {
        await account.updateVerification(userId, secret);
        await refreshAuth();
        setStatus("Email verified. Thank you!");
        setStatusKind("success");
      } catch {
        setStatus("Verification failed. The link may be invalid or have expired.");
        setStatusKind("error");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, secret, refreshAuth]);

  async function handleResend() {
    setResending(true);
    setStatus(null);
    try {
      await account.createVerification(`${window.location.origin}/verify-email`);
      setStatus("Verification email sent. Check your inbox (and spam folder).");
      setStatusKind("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send a verification email.");
      setStatusKind("error");
    } finally {
      setResending(false);
    }
  }

  const waitingForLink = !userId || !secret;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <p className="eyebrow">Changers</p>
          <h1>Verify your email</h1>
          <p className="muted">
            {waitingForLink
              ? "We sent you a verification link. Open it here to confirm your email address."
              : "Confirming your email address…"}
          </p>
        </div>

        {loading && <p className="muted">Verifying…</p>}

        {status && (
          <p className="notice" style={{ ...(statusKind === "success" ? { background: TINTS.teal12, color: "var(--moss)" } : {}) }}>
            {status}
          </p>
        )}

        {user?.emailVerification === true && (
          <p className="notice" style={{ background: TINTS.teal12, color: "var(--moss)" }}>
            Your email is verified. Welcome to Changers!
          </p>
        )}

        {waitingForLink && (
          <div className="button-row" style={{ justifyContent: "center" }}>
            <button className="ghost" onClick={handleResend} disabled={resending}>
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          </div>
        )}

        <p className="muted">
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailForm />
    </Suspense>
  );
}