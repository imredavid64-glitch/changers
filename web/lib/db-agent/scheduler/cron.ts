import { dbAgentConfig } from "../config";
import { runExtendedHealthChecks } from "../health/extended";
import { sendHealthReport, sendCriticalAlert } from "../email/reporter";
import { runAutoFixMigrations } from "../migrations/runner";
import type { PlatformHealthReport } from "../types";

export async function runScheduledHealthCheck(): Promise<void> {
  console.log(`\n⏰ Running scheduled health check at ${new Date().toISOString()}`);
  
  try {
    const report = await runExtendedHealthChecks();
    
    // Always send report
    await sendHealthReport(report);
    
    // Send critical alert if needed
    await sendCriticalAlert(report);
    
    // Auto-fix if enabled and issues found
    if (!report.ok) {
      const { autoFixable } = categorizeChecks(report);
      if (autoFixable.length > 0) {
        console.log(`🔧 Attempting auto-fix for ${autoFixable.length} issue(s)...`);
        await runAutoFixMigrations();
        
        // Re-check after auto-fix
        const followUpReport = await runExtendedHealthChecks();
        if (followUpReport.ok) {
          console.log("✅ Auto-fix resolved all issues");
        } else {
          console.log("⚠️  Some issues remain after auto-fix");
        }
      }
    }
    
    console.log("✅ Scheduled health check complete");
  } catch (error) {
    console.error("❌ Scheduled health check failed:", error);
    throw error;
  }
}

export function parseCronSchedule(schedule: string): { minute: number; hour: number; dayOfMonth: number; month: number; dayOfWeek: number } {
  // Simple cron parser for "0 */6 * * *" format
  const parts = schedule.split(" ");
  if (parts.length !== 5) {
    throw new Error(`Invalid cron schedule: ${schedule}`);
  }
  
  return {
    minute: parseCronPart(parts[0], 0, 59),
    hour: parseCronPart(parts[1], 0, 23),
    dayOfMonth: parseCronPart(parts[2], 1, 31),
    month: parseCronPart(parts[3], 1, 12),
    dayOfWeek: parseCronPart(parts[4], 0, 6),
  };
}

function parseCronPart(part: string, min: number, max: number): number {
  if (part === "*") return -1; // Every
  if (part.startsWith("*/")) {
    const interval = parseInt(part.slice(2));
    return interval; // Return interval for step values
  }
  const val = parseInt(part);
  if (isNaN(val) || val < min || val > max) {
    throw new Error(`Invalid cron value: ${part} (expected ${min}-${max} or */n)`);
  }
  return val;
}

export function getNextRunTime(schedule: string): Date {
  const now = new Date();
  const parsed = parseCronSchedule(schedule);
  
  // Simple implementation for */n hour schedules
  if (parsed.minute === 0 && parsed.hour > 0 && parsed.dayOfMonth === -1 && parsed.month === -1 && parsed.dayOfWeek === -1) {
    const intervalHours = parsed.hour;
    const currentHour = now.getHours();
    const nextHour = Math.ceil((currentHour + 1) / intervalHours) * intervalHours;
    const next = new Date(now);
    next.setHours(nextHour, 0, 0, 0);
    if (next <= now) {
      next.setHours(next.getHours() + intervalHours);
    }
    return next;
  }
  
  // Default: next hour
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next;
}

function categorizeChecks(report: PlatformHealthReport) {
  const autoFixable = report.checks.filter((c) => c.status === "fail" && isAutoFixable(c.key));
  return { autoFixable };
}

function isAutoFixable(key: string): boolean {
  const autoFixablePrefixes = [
    "collections",
    "schema",
    "media-bucket",
    "attr-limit-",
    "index-status-",
  ];
  return autoFixablePrefixes.some((prefix) => key.startsWith(prefix));
}

export function createCronJob(): { schedule: string; handler: () => Promise<void> } {
  return {
    schedule: dbAgentConfig.cron.schedule,
    handler: runScheduledHealthCheck,
  };
}