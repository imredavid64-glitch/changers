import { describe, expect, it } from "vitest";
import {
  buildCasReport,
  buildReflection,
  casReportToMarkdown,
  classifyItem,
  estimateHours,
  type CasSourceItem,
} from "./reflections";

function item(overrides: Partial<CasSourceItem> = {}): CasSourceItem {
  return {
    id: "i1",
    kind: "project",
    title: "River cleanup",
    description: "Organized a weekend river cleanup with 14 volunteers.",
    strand: "N",
    dateMs: 1_700_000_000_000,
    ...overrides,
  };
}

describe("classifyItem", () => {
  it("maps creative tools to creativity", () => {
    for (const kind of ["document", "slideshow", "design", "film", "code"] as const) {
      expect(classifyItem({ kind })).toBe("creativity");
    }
  });

  it("maps events to activity", () => {
    expect(classifyItem({ kind: "event" })).toBe("activity");
  });

  it("maps posts and projects to service", () => {
    expect(classifyItem({ kind: "post" })).toBe("service");
    expect(classifyItem({ kind: "project" })).toBe("service");
  });
});

describe("estimateHours", () => {
  it("estimates more hours for larger experiences", () => {
    expect(estimateHours({ kind: "film" })).toBe(4);
    expect(estimateHours({ kind: "project" })).toBe(5);
    expect(estimateHours({ kind: "post" })).toBe(1);
  });

  it("never returns zero", () => {
    expect(estimateHours({ kind: "event" })).toBeGreaterThan(0);
  });
});

describe("buildReflection", () => {
  it("references the title and strand", () => {
    const reflection = buildReflection(item(), "service");
    expect(reflection).toContain("River cleanup");
    expect(reflection).toContain("Nature");
    expect(reflection).toContain("protecting the natural world");
  });

  it("includes CAS outcome bullets for the category", () => {
    const reflection = buildReflection(item(), "creativity");
    expect(reflection).toContain("- I identified my own strengths");
    expect(reflection).toContain("- I initiated and planned");
  });

  it("does not mention a strand when none is provided", () => {
    const reflection = buildReflection(item({ strand: undefined }), "service");
    expect(reflection).not.toContain("It connects to");
  });

  it("truncates very long descriptions", () => {
    const long = "word ".repeat(80).trim();
    const reflection = buildReflection(item({ description: long }), "service");
    expect(reflection).toContain("…");
    expect(reflection.length).toBeLessThan(700);
  });
});

describe("buildCasReport", () => {
  it("sorts entries newest first", () => {
    const report = buildCasReport([
      item({ id: "old", dateMs: 100 }),
      item({ id: "new", dateMs: 900 }),
    ]);
    expect(report.entries.map((entry) => entry.sourceId)).toEqual(["new", "old"]);
  });

  it("totals hours and per-category counts", () => {
    const report = buildCasReport([
      item({ id: "p", kind: "project", dateMs: 1 }),
      item({ id: "d", kind: "document", dateMs: 2 }),
      item({ id: "e", kind: "event", dateMs: 3 }),
    ]);
    expect(report.byCategory).toEqual({ creativity: 1, activity: 1, service: 1 });
    expect(report.hours).toBe(5 + 2 + 3);
  });

  it("handles an empty report", () => {
    const report = buildCasReport([]);
    expect(report.entries).toEqual([]);
    expect(report.hours).toBe(0);
    expect(report.byCategory.service).toBe(0);
  });
});

describe("casReportToMarkdown", () => {
  it("produces a headed, grouped journal", () => {
    const report = buildCasReport([item()]);
    const markdown = casReportToMarkdown(report, "Ada Lovelace");
    expect(markdown).toContain("# CAS Journal — Ada Lovelace");
    expect(markdown).toContain("## 🤝 Service (1)");
    expect(markdown).toContain("### River cleanup");
    expect(markdown).toContain("approx. 5 h");
    expect(markdown).toContain("During this experience I worked on");
  });

  it("skips empty categories", () => {
    const report = buildCasReport([]);
    const markdown = casReportToMarkdown(report, "Ada");
    expect(markdown).not.toContain("## ");
  });
});
