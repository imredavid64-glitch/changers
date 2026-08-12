"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/components/AuthProvider";
import { Strand } from "@/lib/social/types";
import { STRAND_OPTIONS } from "@/lib/social/utils";
import { TINTS } from "@/lib/theme/tints";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Enter your name."),
  role: z.string().min(2, "Add your role or school."),
  headline: z.string().max(90, "Keep the headline under 90 characters.").optional(),
  location: z.string().max(90, "Keep the location under 90 characters.").optional(),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  interests: z.array(z.enum(["N", "E", "S", "W"])).min(1, "Pick at least one strand."),
});

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      fullName: String(formData.get("fullName") || "").trim(),
      role: String(formData.get("role") || "").trim(),
      headline: String(formData.get("headline") || "").trim(),
      location: String(formData.get("location") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "").trim(),
      interests: formData
        .getAll("interests")
        .map((value) => String(value))
        .filter((value): value is Strand => value === "N" || value === "E" || value === "S" || value === "W"),
    };

    const parsed = signUpSchema.safeParse(payload);
    if (!parsed.success) {
      setStatus(parsed.error.issues[0]?.message || "Check the form details.");
      return;
    }

    setLoading(true);
    try {
      const errorMessage = await signUp(
        parsed.data.fullName,
        parsed.data.role,
        parsed.data.email,
        parsed.data.password,
        {
          headline: parsed.data.headline || "",
          location: parsed.data.location || "",
          interests: parsed.data.interests,
        },
      );

      if (errorMessage) {
        setStatus(errorMessage);
        return;
      }

      router.push("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account creation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <p className="eyebrow">Changers</p>
          <h1>Create account</h1>
          <p className="muted">
            Join the Changemaker network and start building with others.
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input type="text" name="fullName" placeholder="Your name" required />
          </label>
          <label>
            Role or school
            <input type="text" name="role" placeholder="Student leader - ISD" required />
          </label>
          <label>
            Short headline
            <input type="text" name="headline" placeholder="Building youth-led climate projects" />
          </label>
          <label>
            Location
            <input type="text" name="location" placeholder="Dusseldorf, Germany" />
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: "0.9rem" }}>Impact strands</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STRAND_OPTIONS.map((strand) => (
                <label
                  key={strand.value}
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: TINTS.teal8,
                  }}
                >
                  <input
                    type="checkbox"
                    name="interests"
                    value={strand.value}
                    defaultChecked={strand.value === "S"}
                  />
                  {strand.label}
                </label>
              ))}
            </div>
          </div>
          <label>
            Email
            <input type="email" name="email" placeholder="you@school.org" required />
          </label>
          <label>
            Password
            <input type="password" name="password" placeholder="Create a password" required />
          </label>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
          {status && <p className="notice">{status}</p>}
        </form>
        <p className="muted">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
