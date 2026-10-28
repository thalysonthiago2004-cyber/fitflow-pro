import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { dayBounds } from "./time";

export type Appointment = {
  id: string;
  studentId: string;
  studentName: string;
  trainerId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
};

const COLUMNS = "id, student_id, trainer_id, starts_at, ends_at, status, location, notes, students(email, profiles(full_name))";

type Row = {
  id: string;
  student_id: string;
  trainer_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  students: { email: string; profiles: { full_name: string } | null } | null;
};

const toAppointment = (r: Row): Appointment => ({
  id: r.id,
  studentId: r.student_id,
  studentName: r.students?.profiles?.full_name ?? r.students?.email ?? "Aluno",
  trainerId: r.trainer_id,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  location: r.location,
  notes: r.notes,
});

/** Sessions of a workspace between two São Paulo dates (inclusive), by start time. */
export async function listAppointments(workspaceId: string, from: string, to: string): Promise<Appointment[]> {
  const { start, end } = dayBounds(from, to);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at");
  if (error) throw new Error(`Failed to list appointments: ${error.message}`);
  return (data as Row[]).map(toAppointment);
}

/** The student's next sessions that have not ended and are still booked. */
export async function listUpcomingForStudent(studentId: string, limit = 3): Promise<Appointment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUMNS)
    .eq("student_id", studentId)
    .eq("status", "scheduled")
    .gt("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(limit);
  if (error) throw new Error(`Failed to list upcoming appointments: ${error.message}`);
  return (data as Row[]).map(toAppointment);
}
