import { STRAND_LABELS } from "@/lib/social/utils";
import type { Strand } from "@/lib/social/types";

export type CasCategory = "creativity" | "activity" | "service";

export type CasSourceKind =
  | "post"
  | "project"
  | "event"
  | "document"
  | "slideshow"
  | "design"
  | "film"
  | "code";

export interface CasSourceItem {
  id: string;
  kind: CasSourceKind;
  title: string;
  description?: string;
  strand?: Strand;
  dateMs?: number;
  /** True when the user organized/led this event rather than just attending. */
  isEventHost?: boolean;
}

export interface CasEntry {
  id: string;
  category: CasCategory;
  sourceKind: CasSourceKind;
  sourceId: string;
  title: string;
  description: string;
  reflection: string;
  /** Best-effort estimate of hours invested, for the CAS journal total. */
  hours: number;
  dateMs: number;
}

export interface CasReport {
  entries: CasEntry[];
  hours: number;
  byCategory: Record<CasCategory, number>;
}

export const CAS_CATEGORY_LABELS: Record<CasCategory, string> = {
  creativity: "Creativity",
  activity: "Activity",
  service: "Service",
};

export const CAS_CATEGORY_EMOJI: Record<CasCategory, string> = {
  creativity: "🎨",
  activity: "⚽",
  service: "🤝",
};

const CATEGORY_ORDER: CasCategory[] = ["creativity", "activity", "service"];

const KIND_CATEGORY: Record<CasSourceKind, CasCategory> = {
  document: "creativity",
  slideshow: "creativity",
  design: "creativity",
  film: "creativity",
  code: "creativity",
  event: "activity",
  post: "service",
  project: "service",
};

const KIND_HOURS: Record<CasSourceKind, number> = {
  document: 2,
  slideshow: 3,
  design: 2,
  film: 4,
  code: 3,
  event: 3,
  post: 1,
  project: 5,
};

const STRAND_ACTION: Record<Strand, string> = {
  N: "protecting the natural world and acting on climate",
  E: "building fairer economies and access to opportunity",
  S: "strengthening community, inclusion, and justice",
  W: "supporting health, safety, and belonging",
};

const OUTCOMES: Record<CasCategory, [string, string, string]> = {
  creativity: [
    "identified my own strengths and areas for growth while creating something new",
    "took on a challenge and developed new skills through the process",
    "initiated and planned the work from an idea to a finished result",
  ],
  activity: [
    "took on a challenge that pushed me beyond my comfort zone",
    "showed commitment and perseverance by following through over time",
    "developed the skills and benefits of working toward a shared goal with others",
  ],
  service: [
    "engaged with an issue of genuine significance to the community",
    "worked collaboratively with others toward a shared outcome",
    "recognized and reflected on the ethics of the choices and actions involved",
  ],
};

export function classifyItem(item: Pick<CasSourceItem, "kind" | "strand">): CasCategory {
  return KIND_CATEGORY[item.kind];
}

export function estimateHours(item: Pick<CasSourceItem, "kind">): number {
  return KIND_HOURS[item.kind] ?? 1;
}

function truncate(text: string, max = 140) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

export function buildReflection(item: CasSourceItem, category: CasCategory): string {
  const strandText = item.strand
    ? ` It connects to the ${STRAND_LABELS[item.strand]} strand — ${STRAND_ACTION[item.strand]}.`
    : "";
  const context = item.description ? ` The work centred on “${truncate(item.description, 100)}”.` : "";
  const outcomes = OUTCOMES[category].map((outcome) => `- I ${outcome}.`).join("\n");

  return [
    `During this experience I worked on “${item.title}”.${strandText}${context}`,
    "",
    "Looking back, I can see how this supported my CAS development:",
    outcomes,
    "",
    "This experience challenged me to reflect on my role and the impact of my actions, and I would approach the next stage by building on what I learned.",
  ].join("\n");
}

function dateMs(item: CasSourceItem): number {
  return typeof item.dateMs === "number" && Number.isFinite(item.dateMs) ? item.dateMs : 0;
}

export function buildCasReport(items: CasSourceItem[]): CasReport {
  const entries: CasEntry[] = items
    .map((item) => {
      const category = classifyItem(item);
      return {
        id: `${item.kind}-${item.id}`,
        category,
        sourceKind: item.kind,
        sourceId: item.id,
        title: item.title,
        description: truncate(item.description || "", 200),
        reflection: buildReflection(item, category),
        hours: estimateHours(item),
        dateMs: dateMs(item),
      };
    })
    .sort((a, b) => b.dateMs - a.dateMs);

  const byCategory: Record<CasCategory, number> = {
    creativity: 0,
    activity: 0,
    service: 0,
  };
  let hours = 0;
  for (const entry of entries) {
    byCategory[entry.category] += 1;
    hours += entry.hours;
  }

  return { entries, hours, byCategory };
}

export function casReportToMarkdown(report: CasReport, studentName: string): string {
  const lines: string[] = [
    `# CAS Journal — ${studentName}`,
    "",
    `**Total experiences:** ${report.entries.length} · **Estimated hours:** ${report.hours}`,
    "",
  ];

  for (const category of CATEGORY_ORDER) {
    const categoryEntries = report.entries.filter((entry) => entry.category === category);
    if (categoryEntries.length === 0) continue;

    lines.push(`## ${CAS_CATEGORY_EMOJI[category]} ${CAS_CATEGORY_LABELS[category]} (${categoryEntries.length})`);
    lines.push("");
    for (const entry of categoryEntries) {
      const dateText = entry.dateMs
        ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(entry.dateMs)
        : "Date not recorded";
      lines.push(`### ${entry.title}`);
      lines.push(`*${dateText} · approx. ${entry.hours} h*`);
      lines.push("");
      lines.push(entry.description);
      lines.push("");
      lines.push(entry.reflection);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
