"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/components/AuthProvider";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "").trim(),
    };

    const parsed = signInSchema.safeParse(payload);
    if (!parsed.success) {
      setStatus(parsed.error.issues[0]?.message || "Check your sign-in details.");
      return;
    }

    setLoading(true);
    try {
      const errorMessage = await signIn(parsed.data.email, parsed.data.password);
      if (errorMessage) {
        setStatus(errorMessage);
        return;
      }
      router.push("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <p className="eyebrow">Changers</p>
          <h1>Sign in</h1>
          <p className="muted">
            Welcome back. Connect with your changemaker community.
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" name="email" placeholder="you@school.org" required />
          </label>
          <label>
            Password
            <input type="password" name="password" placeholder="Your password" required />
          </label>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {status && <p className="notice">{status}</p>}
        </form>
        <p className="muted">
          New here? <Link href="/sign-up">Create an account</Link> ·{" "}
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
