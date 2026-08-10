import nodemailer from "nodemailer";
import type { ContactMessageRecord } from "./server";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string[];
}

/**
 * Reads SMTP settings from the environment. Forwarding is inert until these are
 * configured:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
 *   SMTP_FROM (defaults to SMTP_USER), CONTACT_FORWARD_TO (comma-separated recipients).
 */
export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    return null;
  }

  const to = (process.env.CONTACT_FORWARD_TO || "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  if (to.length === 0) {
    return null;
  }

  const parsedPort = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  return {
    host,
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 587,
    user,
    pass,
    from: process.env.SMTP_FROM?.trim() || user,
    to,
  };
}

export async function forwardContactMessage(
  record: ContactMessageRecord,
): Promise<{ sent: boolean; reason?: string }> {
  const config = getSmtpConfig();
  if (!config) {
    return { sent: false, reason: "SMTP is not configured." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });

    const subject = record.subject
      ? `[Changers Contact] ${record.subject}`
      : `[Changers Contact] New message from ${record.name}`;

    const text = [
      `New contact message from the Changers website.`,
      ``,
      `Name: ${record.name}`,
      `Email: ${record.email}`,
      record.organization ? `Organization: ${record.organization}` : null,
      `Subject: ${record.subject || "(none)"}`,
      record.pagePath ? `Page: ${record.pagePath}` : null,
      ``,
      `Message:`,
      record.message,
      ``,
      `Reference: ${record.id}`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const html = [
      `<h2>New contact message from changers</h2>`,
      `<table>`,
      `<tr><td><strong>Name</strong></td><td>${escapeHtml(record.name)}</td></tr>`,
      `<tr><td><strong>Email</strong></td><td>${escapeHtml(record.email)}</td></tr>`,
      record.organization ? `<tr><td><strong>Organization</strong></td><td>${escapeHtml(record.organization)}</td></tr>` : "",
      `<tr><td><strong>Subject</strong></td><td>${escapeHtml(record.subject || "(none)")}</td></tr>`,
      record.pagePath ? `<tr><td><strong>Page</strong></td><td>${escapeHtml(record.pagePath)}</td></tr>` : "",
      `</table>`,
      `<p style="white-space: pre-wrap;">${escapeHtml(record.message).replace(/\n/g, "<br>")}</p>`,
      `<p><em>Reference: ${escapeHtml(record.id)}</em></p>`,
    ].join("\n");

    await transporter.sendMail({
      from: config.from,
      to: config.to.join(", "),
      replyTo: record.email,
      subject,
      text,
      html,
    });

    return { sent: true };
  } catch (error) {
    console.error("Contact email forward failed:", error);
    return { sent: false, reason: error instanceof Error ? error.message : "Unknown SMTP error." };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
