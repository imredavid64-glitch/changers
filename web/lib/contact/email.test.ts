import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactMessageRecord } from "./server";

const sampleRecord: ContactMessageRecord = {
  id: "msg-1",
  name: "Jane Doe",
  email: "jane@example.com",
  organization: "Example Org",
  subject: "Partnership",
  message: "Hello team!",
  userId: null,
  consentGiven: true,
  ipAddress: null,
  userAgent: null,
  referrer: null,
  pagePath: "/contact",
  createdAt: new Date().toISOString(),
  readAt: null,
  repliedAt: null,
};

describe("contact email forwarding gating", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "CONTACT_FORWARD_TO"]) {
      delete process.env[key];
    }
  });

  it("reports SMTP as unconfigured when no host is set", async () => {
    const { getSmtpConfig } = await import("./email");
    expect(getSmtpConfig()).toBeNull();
  });

  it("requires both credentials and forward recipients", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";
    const { getSmtpConfig } = await import("./email");
    // No CONTACT_FORWARD_TO yet.
    expect(getSmtpConfig()).toBeNull();

    process.env.CONTACT_FORWARD_TO = "team@example.com, other@example.com";
    const config = getSmtpConfig();
    expect(config).not.toBeNull();
    expect(config!.host).toBe("smtp.example.com");
    expect(config!.port).toBe(587);
    expect(config!.to).toEqual(["team@example.com", "other@example.com"]);
  });

  it("forward and reply are inert (skipped, not failed) without SMTP", async () => {
    const { forwardContactMessage, sendReplyEmail } = await import("./email");
    const forward = await forwardContactMessage(sampleRecord);
    expect(forward.sent).toBe(false);
    expect(forward.reason).toContain("SMTP is not configured");

    const reply = await sendReplyEmail(sampleRecord, "Thanks for reaching out!");
    expect(reply.sent).toBe(false);
    expect(reply.reason).toContain("SMTP is not configured");
  });
});
