import { describe, expect, it } from "vitest";
import { buildRoster, daysAgo, filterRoster, isInactive, sortRoster } from "./roster";

const TODAY = "2026-10-28";
const student = (userId: string, fullName: string, joinedAt: string) => ({ userId, fullName, email: `${userId}@example.com`, status: "active" as const, goal: null, joinedAt });

const roster = buildRoster({
  today: TODAY,
  students: [student("a", "Carla Dias", "2026-10-01T10:00:00Z"), student("b", "Bruno Lima", "2026-10-20T10:00:00Z"), student("c", "Ana Souza", "2026-09-01T10:00:00Z")],
  activePlans: [
    { id: "p1", name: "Antigo", studentId: "a", updatedAt: "2026-10-01T00:00:00Z" },
    { id: "p2", name: "Hipertrofia", studentId: "a", updatedAt: "2026-10-20T00:00:00Z" },
    { id: "p3", name: "Base", studentId: "c", updatedAt: "2026-10-02T00:00:00Z" },
  ],
  completions: [
    { studentId: "a", date: "2026-10-27" },
    { studentId: "a", date: "2026-09-01" },
    { studentId: "c", date: "2026-10-10" },
  ],
  upcoming: [
    { studentId: "a", startsAt: "2026-10-29T10:30:00Z", location: "Academia" },
    { studentId: "a", startsAt: "2026-11-05T10:30:00Z", location: null },
  ],
});

describe("buildRoster", () => {
  it("summarizes each student's plan, activity and next session", () => {
    expect(roster[0]).toMatchObject({
      activePlan: { id: "p2", name: "Hipertrofia" },
      lastWorkout: "2026-10-27",
      workouts30: 1,
      nextSession: { startsAt: "2026-10-29T10:30:00Z", location: "Academia" },
    });
    expect(roster[1]).toMatchObject({ activePlan: null, lastWorkout: null, workouts30: 0, nextSession: null });
  });
});

describe("filters", () => {
  it("finds students without an active plan", () => {
    expect(filterRoster(roster, "no_plan", TODAY).map((e) => e.userId)).toEqual(["b"]);
  });

  it("finds students idle for a week or who never trained", () => {
    expect(filterRoster(roster, "inactive", TODAY).map((e) => e.userId)).toEqual(["b", "c"]);
    expect(isInactive(roster[0], TODAY)).toBe(false);
  });
});

describe("sortRoster", () => {
  it("sorts by name, last workout (never last) and join date", () => {
    expect(sortRoster(roster, "name").map((e) => e.fullName)).toEqual(["Ana Souza", "Bruno Lima", "Carla Dias"]);
    expect(sortRoster(roster, "last").map((e) => e.userId)).toEqual(["a", "c", "b"]);
    expect(sortRoster(roster, "recent").map((e) => e.userId)).toEqual(["b", "a", "c"]);
  });
});

describe("daysAgo", () => {
  it("reads naturally", () => {
    expect(daysAgo(TODAY, TODAY)).toBe("hoje");
    expect(daysAgo("2026-10-27", TODAY)).toBe("ontem");
    expect(daysAgo("2026-10-20", TODAY)).toBe("há 8 dias");
    expect(daysAgo(null, TODAY)).toBeNull();
  });
});
