"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageSquare, Building2, ShieldCheck } from "lucide-react";

const BUSINESS_EMAIL = "30dimrekatai@student.aisb.hu";
const GENERAL_EMAIL = "davidimrekatai@gmail.com";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(16,24,32,0.15)",
  background: "var(--surface-card-solid)",
  fontSize: "0.95rem",
  color: "var(--ink)",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export default function ContactPage() {
  const [status, setStatus] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      organization: String(formData.get("organization") || ""),
      subject: String(formData.get("subject") || ""),
      message: String(formData.get("message") || ""),
      company: String(formData.get("company") || ""),
      consent: formData.get("consent") === "on",
      pagePath: typeof window !== "undefined" ? window.location.pathname : "/contact",
    };

    setLoading(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || data.ok !== true) {
        setStatus({ kind: "error", text: data.error || "We couldn't send your message. Please try again." });
        return;
      }
      setStatus({ kind: "success", text: data.message || "Message sent!" });
      event.currentTarget.reset();
    } catch {
      setStatus({ kind: "error", text: "Network error — please check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 64px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <p className="eyebrow">Contact</p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontFamily: "var(--font-head)", color: "var(--ink)", marginBottom: 12 }}>
          Let&apos;s build together
        </h1>
        <p className="muted" style={{ fontSize: "1.05rem", maxWidth: 640, margin: "0 auto", lineHeight: 1.7 }}>
          Questions, partnerships, press, or feedback — the Changers team reads every message.
          Businesses and organizations can reach us directly at the addresses below.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 40 }}>
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🤝</div>
          <h3 style={{ fontSize: "1.15rem", fontFamily: "var(--font-head)", marginBottom: 8 }}>Business & partnerships</h3>
          <p className="muted" style={{ fontSize: "0.9rem", marginBottom: 16, lineHeight: 1.6 }}>
            Sponsorships, school partnerships, media, and organizations who want to work with changemakers.
          </p>
          <a className="primary" href={`mailto:${BUSINESS_EMAIL}`} style={{ textDecoration: "none", display: "inline-block", padding: "12px 20px", borderRadius: 999, fontSize: "0.9rem" }}>
            <Mail size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
            {BUSINESS_EMAIL}
          </a>
        </div>
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>💬</div>
          <h3 style={{ fontSize: "1.15rem", fontFamily: "var(--font-head)", marginBottom: 8 }}>General & feedback</h3>
          <p className="muted" style={{ fontSize: "0.9rem", marginBottom: 16, lineHeight: 1.6 }}>
            Bug reports, feature ideas, account help, or anything else on your mind.
          </p>
          <a className="primary" href={`mailto:${GENERAL_EMAIL}`} style={{ textDecoration: "none", display: "inline-block", padding: "12px 20px", borderRadius: 999, fontSize: "0.9rem" }}>
            <Mail size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
            {GENERAL_EMAIL}
          </a>
        </div>
      </div>

      <div className="card" style={{ padding: "32px 40px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <MessageSquare size={22} style={{ color: "var(--moss)" }} />
          <h2 style={{ fontSize: "1.4rem", fontFamily: "var(--font-head)", color: "var(--ink)" }}>Send us a message</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0, overflow: "hidden" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Your name *</span>
              <input type="text" name="name" required maxLength={120} placeholder="Jane Changemaker" style={INPUT_STYLE} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Email *</span>
              <input type="email" name="email" required maxLength={200} placeholder="you@organization.org" style={INPUT_STYLE} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Organization <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
              <input type="text" name="organization" maxLength={200} placeholder="School, business, or NGO" style={INPUT_STYLE} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Subject <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
              <input type="text" name="subject" maxLength={200} placeholder="Partnership, feedback, help..." style={INPUT_STYLE} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Message *</span>
            <textarea name="message" required maxLength={5000} rows={6} placeholder="Tell us what you're working on and how we can help." style={{ ...INPUT_STYLE, resize: "vertical", lineHeight: 1.6 }} />
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.85rem", color: "var(--text-soft)", lineHeight: 1.5 }}>
            <input type="checkbox" name="consent" required style={{ marginTop: 3, width: 16, height: 16 }} />
            <span>
              I agree that Changers stores my name, email, and message — along with the page I was on — so the team can
              read and reply to my message. See the <Link href="/privacy" style={{ color: "var(--teal)", fontWeight: 600 }}>privacy policy</Link>.
              <span style={{ color: "var(--coral)" }}>*</span>
            </span>
          </label>

          {status && (
            <p className={`notice ${status.kind === "success" ? "" : ""}`} style={{ margin: 0, ...(status.kind === "success" ? { background: "color-mix(in srgb, var(--teal) 12%, transparent)", color: "var(--moss)" } : {}) }}>
              {status.text}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <button type="submit" className="primary" disabled={loading} style={{ padding: "14px 32px", borderRadius: 999, fontSize: "1rem" }}>
              {loading ? "Sending..." : "Send message"}
            </button>
            <span className="muted" style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} /> Your data stays private — no ads, no sharing.
            </span>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: 24, maxWidth: 720, margin: "24px auto 0", display: "flex", gap: 16, alignItems: "flex-start", background: "color-mix(in srgb, var(--teal) 6%, transparent)" }}>
        <Building2 size={20} style={{ color: "var(--moss)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: "0.9rem", color: "var(--text-body)", lineHeight: 1.7 }}>
          <strong>For businesses:</strong> Changers is a student-led changemaker platform. If you&apos;d like to sponsor an event,
          run a workshop, or bring your organization&apos;s mission to our community, email{" "}
          <a href={`mailto:${BUSINESS_EMAIL}`} style={{ color: "var(--moss)", fontWeight: 600 }}>{BUSINESS_EMAIL}</a> —
          we reply to every serious inquiry.
        </div>
      </div>
    </div>
  );
}
