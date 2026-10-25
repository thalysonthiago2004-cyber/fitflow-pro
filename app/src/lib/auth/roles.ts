import type { WorkspaceRole } from "@/lib/supabase/database.types";

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  trainer: "Personal",
  student: "Aluno",
};

export function isStaffRole(role: WorkspaceRole | undefined): boolean {
  return role === "owner" || role === "trainer";
}
