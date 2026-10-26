import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole, WorkspaceRole } from "@/lib/supabase/database.types";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  avatarPath: string | null;
  whatsapp: string | null;
  role: UserRole;
  workspace: { id: string; name: string; role: WorkspaceRole } | null;
};

// Verifies the session server-side and loads the user's profile and
// workspace. Role and membership come from the database, never the client.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return null;

  const [{ data: profile, error: profileError }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, avatar_path, whatsapp").eq("id", claims.sub).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role, workspaces(id, name)")
      .eq("user_id", claims.sub)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // A valid session without a profile means the database is out of sync
  // (e.g. migrations not applied). Throw instead of redirecting to /login,
  // which the proxy would bounce back here in a loop.
  if (profileError || !profile) throw new Error("Authenticated user has no profile.");

  const workspace = membership?.workspaces
    ? { id: membership.workspaces.id, name: membership.workspaces.name, role: membership.role }
    : null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile.full_name,
    avatarPath: profile.avatar_path,
    whatsapp: profile.whatsapp,
    role: profile.role,
    workspace,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type StaffUser = CurrentUser & {
  workspace: NonNullable<CurrentUser["workspace"]> & { role: "owner" | "trainer" };
};

// Trainer-only pages. Students are sent back to their dashboard; RLS still
// enforces the boundary for any data the page would load.
export async function requireStaff(): Promise<StaffUser> {
  const user = await requireUser();
  const role = user.workspace?.role;
  if (!user.workspace || (role !== "owner" && role !== "trainer")) redirect("/dashboard");
  return user as StaffUser;
}
