import { describe, expect, it } from "vitest";
import { type ReportStudent, buildReport, parseRange, sortRows, toCsv } from "./build";

const TODAY = "2026-10-28";

describe("parseRange", () => {
  it("defaults to the last 30 days", () => {
    expect(parseRange({}, TODAY)).toEqual({ from: "2026-09-29", to: TODAY, days: 30, preset: 30 });
  });

  it("accepts presets", () => {
    expect(parseRange({ periodo: "365" }, TODAY)).toMatchObject({ from: "2025-10-29", days: 365, preset: 365 });
    expect(parseRange({ periodo: "12" }, TODAY).preset).toBe(30);
  });

  it("accepts a custom range and clamps the end to today", () => {
    expect(parseRange({ de: "2026-10-01", ate: "2026-10-10" }, TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-10", days: 10, preset: null });
    expect(parseRange({ de: "2026-10-20", ate: "2026-12-31" }, TODAY)).toMatchObject({ to: TODAY, days: 9 });
  });

  it("falls back to the preset for invalid or too long ranges", () => {
    expect(parseRange({ de: "2026-10-10", ate: "2026-10-01" }, TODAY).preset).toBe(30);
    expect(parseRange({ de: "2024-01-01", ate: "2026-10-01" }, TODAY).preset).toBe(30);
    expect(parseRange({ de: "2026-02-31", ate: "2026-03-05" }, TODAY).preset).toBe(30);
    expect(parseRange({ de: "ontem", ate: TODAY }, TODAY).preset).toBe(30);
  });
});

describe("buildReport", () => {
  const students: ReportStudent[] = [
    { id: "a", name: "Carla Dias", status: "active", joinedDate: "2026-10-25" },
    { id: "b", name: "Bruno Lima", status: "active", joinedDate: "2026-01-10" },
    { id: "c", name: "Antiga", status: "archived", joinedDate: "2025-05-01" },
    { id: "d", name: "Arquivada ativa", status: "archived", joinedDate: "2025-05-01" },
  ];
  const range = { from: "2026-10-15", to: TODAY, days: 14, preset: null };
  const { summary, rows } = buildReport({
    students,
    range,
    completions: [
      { date: "2026-10-16", studentId: "a" },
      { date: "2026-10-27", studentId: "a" },
      { date: "2026-10-01", studentId: "b" }, // before the range
      { date: "2026-10-20", studentId: "d" },
    ],
    appointments: [
      { studentId: "a", date: "2026-10-16", status: "completed" },
      { studentId: "a", date: "2026-10-23", status: "no_show" },
      { studentId: "a", date: "2026-10-24", status: "completed" },
      { studentId: "b", date: "2026-10-20", status: "cancelled" },
      { studentId: "b", date: "2026-11-02", status: "scheduled" }, // after the range
    ],
  });

  it("builds one row per active student plus archived ones with activity", () => {
    expect(rows.map((r) => r.studentId)).toEqual(["a", "b", "d"]);
    expect(rows[0]).toEqual({
      studentId: "a",
      name: "Carla Dias",
      status: "active",
      workouts: 2,
      perWeek: 1,
      lastWorkout: "2026-10-27",
      sessionsDone: 2,
      noShows: 1,
      cancelled: 0,
      attendance: 2 / 3,
    });
    expect(rows[1]).toMatchObject({ workouts: 0, lastWorkout: null, cancelled: 1, attendance: null });
  });

  it("summarizes the range", () => {
    expect(summary).toEqual({
      workouts: 3,
      studentsTrained: 2,
      activeStudents: 2,
      adherence: 1,
      newStudents: 1,
      sessionsBooked: 3,
      sessionsDone: 2,
      noShows: 1,
      cancelled: 1,
      attendance: 2 / 3,
    });
  });

  it("sorts by activity with names breaking ties", () => {
    expect(sortRows(rows, "workouts").map((r) => r.studentId)).toEqual(["a", "d", "b"]);
    expect(sortRows(rows, "name").map((r) => r.name)).toEqual(["Arquivada ativa", "Bruno Lima", "Carla Dias"]);
    expect(sortRows(rows, "last").map((r) => r.studentId)).toEqual(["a", "d", "b"]);
    expect(sortRows(rows, "attendance").map((r) => r.studentId)).toEqual(["a", "d", "b"]);
  });

  it("exports a spreadsheet-safe CSV", () => {
    const csv = toCsv([...rows, { ...rows[1], name: '=HYPERLINK("x");Bad' }]);
    expect(csv.startsWith("﻿Aluno;Situação;Treinos concluídos;")).toBe(true);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[1]).toBe("Carla Dias;Ativo;2;1;27/10/2026;2;1;0;67");
    expect(lines[2]).toBe("Bruno Lima;Ativo;0;0;;0;0;1;");
    expect(lines[4]).toBe(`"'=HYPERLINK(""x"");Bad";Ativo;0;0;;0;0;1;`);
  });
});
