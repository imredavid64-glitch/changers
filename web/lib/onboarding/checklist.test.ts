import { describe, expect, it } from "vitest";
import { buildChecklist, isProfileComplete } from "./checklist";

describe("isProfileComplete", () => {
  it("is false for a missing profile", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it("is false when any key field is missing or blank", () => {
    expect(isProfileComplete({ headline: "H", bio: "B", location: "" })).toBe(false);
    expect(isProfileComplete({ headline: "H", bio: "  ", location: "L" })).toBe(false);
    expect(isProfileComplete({ headline: "", bio: "B", location: "L" })).toBe(false);
  });

  it("is true when headline, bio, and location are all filled", () => {
    expect(isProfileComplete({ headline: "H", bio: "B", location: "L" })).toBe(true);
  });
});

describe("buildChecklist", () => {
  it("starts with everything incomplete for a brand-new user", () => {
    const checklist = buildChecklist(null, { posts: 0, rooms: 0, projects: 0 });
    expect(checklist.done).toBe(false);
    expect(checklist.completedCount).toBe(0);
    expect(checklist.steps.every((step) => !step.complete)).toBe(true);
  });

  it("marks each step complete from activity counts and profile", () => {
    const checklist = buildChecklist(
      { headline: "H", bio: "B", location: "L" },
      { posts: 1, rooms: 1, projects: 1 },
    );
    expect(checklist.done).toBe(true);
    expect(checklist.completedCount).toBe(4);
    expect(checklist.steps.every((step) => step.complete)).toBe(true);
  });

  it("marks only the completed steps individually", () => {
    const checklist = buildChecklist(null, { posts: 3, rooms: 0, projects: 0 });
    const byId = Object.fromEntries(checklist.steps.map((step) => [step.id, step]));
    expect(byId.profile.complete).toBe(false);
    expect(byId.post.complete).toBe(true);
    expect(byId.room.complete).toBe(false);
    expect(byId.project.complete).toBe(false);
    expect(checklist.done).toBe(false);
    expect(checklist.completedCount).toBe(1);
  });

  it("uses the per-user href for the profile step when provided", () => {
    const checklist = buildChecklist(
      null,
      { posts: 0, rooms: 0, projects: 0 },
      "/profile/user-123",
    );
    const profileStep = checklist.steps.find((step) => step.id === "profile");
    expect(profileStep?.href).toBe("/profile/user-123");
  });
});
