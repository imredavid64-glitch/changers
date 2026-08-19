"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { account } from "@/lib/appwrite/client";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email."),
});

export default function ForgotPasswordPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus(parsed.error.issues[0]?.message || "Enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await account.createRecovery(email, `${window.location.origin}/reset-password`);
      setStatus(
        "If an account exists for that email, we've sent a password reset link. Check your inbox (and spam folder).",
      );
    } catch {
      setStatus(
        "If an account exists for that email, we've sent a password reset link. Check your inbox (and spam folder).",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <p className="eyebrow">Changers</p>
          <h1>Forgot password</h1>
          <p className="muted">
            Enter the email on your account and we&apos;ll send you a link to reset your password.
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" name="email" placeholder="you@school.org" required />
          </label>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
          {status && <p className="notice">{status}</p>}
        </form>
        <p className="muted">
          Remembered it? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </div>
  );
}