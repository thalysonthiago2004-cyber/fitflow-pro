import { addDays, formatDate, formatNumber, isCalendarDate } from "@/lib/format";
import type { AppointmentStatus, StudentStatus } from "@/lib/supabase/database.types";
import { adherence, type Completion, type DateRange } from "@/lib/dashboard/metrics";

// Reports: per-student activity over a date range, from recorded workouts and
// agenda sessions only. Financial figures are absent because the app does not
// record payments yet.

export const REPORT_PRESETS = [7, 30, 90, 365] as const;
export const MAX_RANGE_DAYS = 366;

export type ReportRange = DateRange & { days: number; preset: number | null };


export const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000) + 1;

/** A custom range (de/ate) when valid, otherwise a preset ending today (30 days by default). */
export function parseRange(params: { periodo?: unknown; de?: unknown; ate?: unknown }, today: string): ReportRange {
  if (isCalendarDate(params.de) && isCalendarDate(params.ate) && params.de <= params.ate) {
    const to = params.ate > today ? today : params.ate;
    const days = daysBetween(params.de, to);
    if (days >= 1 && days <= MAX_RANGE_DAYS) return { from: params.de, to, days, preset: null };
  }
  const n = Number(params.periodo);
  const preset = (REPORT_PRESETS as readonly number[]).includes(n) ? n : 30;
  return { from: addDays(today, -(preset - 1)), to: today, days: preset, preset };
}

export type ReportStudent = { id: string; name: string; status: StudentStatus; joinedDate: string };
export type ReportAppointment = { studentId: string; date: string; status: AppointmentStatus };

export type StudentRow = {
  studentId: string;
  name: string;
  status: StudentStatus;
  workouts: number;
  perWeek: number;
  lastWorkout: string | null;
  sessionsDone: number;
  noShows: number;
  cancelled: number;
  /** Realizadas ÷ (realizadas + faltas); null without either. */
  attendance: number | null;
};

export type ReportSummary = {
  workouts: number;
  studentsTrained: number;
  activeStudents: number;
  adherence: number | null;
  newStudents: number;
  sessionsBooked: number;
  sessionsDone: number;
  noShows: number;
  cancelled: number;
  attendance: number | null;
};

const ratio = (done: number, missed: number) => (done + missed > 0 ? done / (done + missed) : null);

export function buildReport(input: { students: ReportStudent[]; completions: Completion[]; appointments: ReportAppointment[]; range: ReportRange }) {
  const { range } = input;
  const inRange = (d: string) => d >= range.from && d <= range.to;
  const completions = input.completions.filter((c) => inRange(c.date));
  const appointments = input.appointments.filter((a) => inRange(a.date));
  const weeks = range.days / 7;

  const rows: StudentRow[] = input.students
    .map((s) => {
      const mine = completions.filter((c) => c.studentId === s.id);
      const sessions = appointments.filter((a) => a.studentId === s.id);
      const done = sessions.filter((a) => a.status === "completed").length;
      const noShows = sessions.filter((a) => a.status === "no_show").length;
      return {
        studentId: s.id,
        name: s.name,
        status: s.status,
        workouts: mine.length,
        perWeek: Math.round((mine.length / weeks) * 10) / 10,
        lastWorkout: mine.reduce<string | null>((last, c) => (last === null || c.date > last ? c.date : last), null),
        sessionsDone: done,
        noShows,
        cancelled: sessions.filter((a) => a.status === "cancelled").length,
        attendance: ratio(done, noShows),
      };
    })
    // Archived students only appear when they did something in the range.
    .filter((r) => r.status === "active" || r.workouts > 0 || r.sessionsDone + r.noShows + r.cancelled > 0);

  const active = input.students.filter((s) => s.status === "active").length;
  const trained = new Set(completions.map((c) => c.studentId)).size;
  const sessionsDone = appointments.filter((a) => a.status === "completed").length;
  const noShows = appointments.filter((a) => a.status === "no_show").length;
  const summary: ReportSummary = {
    workouts: completions.length,
    studentsTrained: trained,
    activeStudents: active,
    adherence: adherence(trained, active),
    newStudents: input.students.filter((s) => inRange(s.joinedDate)).length,
    sessionsBooked: appointments.filter((a) => a.status !== "cancelled").length,
    sessionsDone,
    noShows,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
    attendance: ratio(sessionsDone, noShows),
  };
  return { summary, rows };
}

export const SORT_KEYS = ["name", "workouts", "last", "attendance"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const parseSort = (value: unknown): SortKey => ((SORT_KEYS as readonly string[]).includes(value as string) ? (value as SortKey) : "workouts");

/** Name A–Z; the others put the most active (or most recent) first, ties by name. */
export function sortRows(rows: StudentRow[], key: SortKey): StudentRow[] {
  const byName = (a: StudentRow, b: StudentRow) => a.name.localeCompare(b.name, "pt-BR");
  const desc = (a: number | string | null, b: number | string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? 1 : -1);
  return [...rows].sort((a, b) => {
    if (key === "name") return byName(a, b);
    const primary = key === "workouts" ? desc(a.workouts, b.workouts) : key === "last" ? desc(a.lastWorkout, b.lastWorkout) : desc(a.attendance, b.attendance);
    return primary || byName(a, b);
  });
}

export const STUDENT_STATUS_TEXT: Record<StudentStatus, string> = { active: "Ativo", archived: "Arquivado" };

// Spreadsheet-friendly CSV for Brazilian Excel/Sheets: ";" separator, decimal
// comma, dd/MM/yyyy, UTF-8 BOM. Cells that would start a formula are quoted
// with a leading apostrophe (CSV injection).
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const CSV_HEADERS = [
  "Aluno",
  "Situação",
  "Treinos concluídos",
  "Treinos por semana",
  "Último treino no período",
  "Sessões realizadas",
  "Faltas",
  "Sessões canceladas",
  "Presença nas sessões (%)",
] as const;

export function toCsv(rows: StudentRow[]): string {
  const lines = [
    CSV_HEADERS.join(";"),
    ...rows.map((r) =>
      [
        r.name,
        STUDENT_STATUS_TEXT[r.status],
        String(r.workouts),
        formatNumber(r.perWeek, 1),
        r.lastWorkout ? formatDate(r.lastWorkout) : "",
        String(r.sessionsDone),
        String(r.noShows),
        String(r.cancelled),
        r.attendance === null ? "" : String(Math.round(r.attendance * 100)),
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
