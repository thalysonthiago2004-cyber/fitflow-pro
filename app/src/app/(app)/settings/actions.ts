"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import { type FormState, profileSchema, workspaceSchema } from "@/lib/auth/schemas";
import { AVATAR_MAX_BYTES, checkJpeg } from "@/lib/images/validate";
import { createClient } from "@/lib/supabase/server";

const SAVE_ERROR = "Não foi possível salvar. Tente novamente.";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fullName = formString(formData, "fullName");
  const parsed = profileSchema.safeParse({ fullName });
  if (!parsed.success) return validationError(parsed.error, { fullName });

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);
  if (error) return { status: "error", message: SAVE_ERROR, values: { fullName } };

  refresh();
  return { status: "success", message: "Perfil atualizado.", values: { fullName: parsed.data.fullName } };
}

export async function updateWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = formString(formData, "name");
  const parsed = workspaceSchema.safeParse({ name });
  if (!parsed.success) return validationError(parsed.error, { name });

  // The workspace comes from the server-side membership lookup, never the form.
  // RLS also restricts updates to the owner; this check gives a clear message.
  if (!user.workspace || user.workspace.role !== "owner") {
    return { status: "error", message: "Apenas o proprietário pode alterar o espaço.", values: { name } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", user.workspace.id)
    .select("id");
  if (error || !data?.length) return { status: "error", message: SAVE_ERROR, values: { name } };

  refresh();
  return { status: "success", message: "Espaço de trabalho atualizado.", values: { name: parsed.data.name } };
}

export type AvatarResult = { ok: true } | { ok: false; message: string };

// The browser crops and re-encodes the photo; the server still checks it.
// Files live under the user's own folder, which storage RLS enforces.
export async function uploadAvatar(formData: FormData): Promise<AvatarResult> {
  const user = await requireUser();
  const check = await checkJpeg(formData.get("avatar"), AVATAR_MAX_BYTES);
  if (!check.ok) return check;

  const supabase = await createClient();
  const path = `${user.id}/avatar-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, check.file, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (uploadError) return { ok: false, message: SAVE_ERROR };

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) {
    await supabase.storage.from("avatars").remove([path]);
    return { ok: false, message: SAVE_ERROR };
  }
  if (user.avatarPath) await supabase.storage.from("avatars").remove([user.avatarPath]);

  refresh();
  return { ok: true };
}

export async function removeAvatar(): Promise<AvatarResult> {
  const user = await requireUser();
  if (!user.avatarPath) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (error) return { ok: false, message: SAVE_ERROR };
  await supabase.storage.from("avatars").remove([user.avatarPath]);
  refresh();
  return { ok: true };
}
