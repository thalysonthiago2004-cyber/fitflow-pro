import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ExperienceLevel, Sex, StudentStatus } from "@/lib/supabase/database.types";

export type StudentSummary = {
  userId: string;
  fullName: string;
  email: string;
  status: StudentStatus;
  goal: string | null;
  joinedAt: string;
};

export type StudentDetail = StudentSummary & {
  experienceLevel: ExperienceLevel | null;
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
  limitations: string | null;
};

export type PendingInvitation = {
  id: string;
  fullName: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

// All reads go through the caller's session, so RLS decides what is visible.

export async function listStudents(workspaceId: string): Promise<StudentSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("user_id, email, status, goal, joined_at, profiles(full_name)")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Failed to list students: ${error.message}`);

  return data
    .map((row) => ({
      userId: row.user_id,
      fullName: row.profiles?.full_name ?? row.email,
      email: row.email,
      status: row.status,
      goal: row.goal,
      joinedAt: row.joined_at,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

export async function getStudent(workspaceId: string, userId: string): Promise<StudentDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("*, profiles(full_name)")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load student: ${error.message}`);
  if (!data) return null;

  return {
    userId: data.user_id,
    fullName: data.profiles?.full_name ?? data.email,
    email: data.email,
    status: data.status,
    goal: data.goal,
    joinedAt: data.joined_at,
    experienceLevel: data.experience_level,
    sex: data.sex,
    birthDate: data.birth_date,
    heightCm: data.height_cm === null ? null : Number(data.height_cm),
    limitations: data.limitations,
  };
}

export async function listPendingInvitations(workspaceId: string): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, full_name, email, expires_at, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list invitations: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

/** The workspace owner, as the student sees them. */
export async function getTrainer(workspaceId: string): Promise<{ fullName: string; avatarPath: string | null; whatsapp: string | null } | null> {
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_path, whatsapp")
    .eq("id", workspace.owner_id)
    .maybeSingle();
  return profile ? { fullName: profile.full_name, avatarPath: profile.avatar_path, whatsapp: profile.whatsapp } : null;
}
