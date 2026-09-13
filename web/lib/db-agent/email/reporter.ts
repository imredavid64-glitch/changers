import { dbAgentConfig } from "../config";
import { sendEmail } from "@/lib/contact/email";
import { formatHealthReportMarkdown, formatHealthReportSummary } from "../health/report";
import type { PlatformHealthReport, EmailReportOptions } from "../types";

export async function sendHealthReport(report: PlatformHealthReport): Promise<void> {
  const markdown = formatHealthReportMarkdown(report);
  const summary = formatHealthReportSummary(report);
  
  const emailOptions: EmailReportOptions = {
    to: dbAgentConfig.email.to,
    from: dbAgentConfig.email.from,
    subject: `[Changers DB Agent] ${summary}`,
    html: markdownToHtml(markdown),
    text: markdown,
  };

  try {
    await sendEmail(emailOptions);
    console.log(`📧 Health report emailed to ${dbAgentConfig.email.to}`);
  } catch (error) {
    console.error("Failed to send health report email:", error);
    throw error;
  }
}

export async function sendCriticalAlert(report: PlatformHealthReport): Promise<void> {
  const failedChecks = report.checks.filter((c) => c.status === "fail");
  const criticalFailures = failedChecks.filter((c) => isCritical(c.key));
  
  if (criticalFailures.length === 0) return;

  const markdown = formatHealthReportMarkdown(report);
  const subject = `🚨 CRITICAL: Changers DB Health - ${criticalFailures.length} critical failure(s)`;
  
  const emailOptions: EmailReportOptions = {
    to: dbAgentConfig.email.to,
    from: dbAgentConfig.email.from,
    subject,
    html: markdownToHtml(markdown),
    text: markdown,
  };

  try {
    await sendEmail(emailOptions);
    console.log(`🚨 Critical alert emailed to ${dbAgentConfig.email.to}`);
  } catch (error) {
    console.error("Failed to send critical alert email:", error);
  }
}

function isCritical(key: string): boolean {
  const criticalKeys = ["endpoint", "database", "collections"];
  return criticalKeys.some((k) => key.startsWith(k));
}

function markdownToHtml(markdown: string): string {
  // Simple markdown to HTML conversion for email
  return markdown
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(.+)$/gm, "<p>$1</p>")
    .replace(/<p>---<\/p>/g, "<hr>")
    .replace(/<p><\/p>/g, "");
}