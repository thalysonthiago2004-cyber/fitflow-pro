import "server-only";

import { weekStart, weeklyCounts } from "@/lib/progress/calc";
import { getWorkspaceCompletions } from "@/lib/progress/queries";
import { listAppointments } from "@/lib/schedule/queries";
import { localDate } from "@/lib/schedule/time";
import { listStudents } from "@/lib/students/queries";
import { type ReportRange, buildReport } from "./build";

/** Everything a report needs for one range, read with the caller's session (RLS). */
export async function loadReport(workspaceId: string, range: ReportRange) {
  const [students, completions, appointments] = await Promise.all([
    listStudents(workspaceId),
    getWorkspaceCompletions(workspaceId, range.from),
    listAppointments(workspaceId, range.from, range.to),
  ]);
  const report = buildReport({
    range,
    students: students.map((s) => ({ id: s.userId, name: s.fullName, status: s.status, joinedDate: localDate(s.joinedAt) })),
    completions,
    appointments: appointments.map((a) => ({ studentId: a.studentId, date: localDate(a.startsAt), status: a.status })),
  });
  const inRange = completions.filter((c) => c.date >= range.from && c.date <= range.to).map((c) => c.date);
  // Every calendar week the range touches (Monday-based), at most a year.
  const span = (new Date(`${weekStart(range.to)}T12:00:00Z`).getTime() - new Date(`${weekStart(range.from)}T12:00:00Z`).getTime()) / (7 * 86_400_000) + 1;
  const weeks = weeklyCounts(inRange, range.to, Math.min(53, Math.round(span)));
  return { ...report, weeks, hasStudents: students.length > 0 };
}
