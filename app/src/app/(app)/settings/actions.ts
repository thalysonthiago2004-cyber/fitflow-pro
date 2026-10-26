"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import { type FormState, profileSchema, workspaceSchema } from "@/lib/auth/schemas";
import { AVATAR_MAX_BYTES, checkJpeg } from "@/lib/images/validate";
import { normalizeWhatsapp } from "@/lib/phone";
import { studentProfileSchema } from "@/lib/students/schemas";
import { RATE_LIMITED, allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const SAVE_ERROR = "Não foi possível salvar. Tente novamente.";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fullName = formString(formData, "fullName");
  const whatsappInput = formString(formData, "whatsapp");
  const values = { fullName, whatsapp: whatsappInput };
  const parsed = profileSchema.safeParse({ fullName });
  if (!parsed.success) return validationError(parsed.error, values);
  // Only trainers show a WhatsApp number (to their students).
  const whatsapp = user.role === "trainer" ? normalizeWhatsapp(whatsappInput) : null;
  if (whatsapp === "invalid") {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { whatsapp: ["Use DDD e número, ex.: (11) 98765-4321."] }, values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, ...(user.role === "trainer" ? { whatsapp } : {}) })
    .eq("id", user.id);
  if (error) return { status: "error", message: SAVE_ERROR, values };

  refresh();
  return { status: "success", message: "Perfil atualizado.", values: { fullName: parsed.data.fullName, whatsapp: whatsappInput } };
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
  if (!(await allow(supabase, "avatar"))) return { ok: false, message: RATE_LIMITED };
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

// Account ----------------------------------------------------------------------

export type AccountResult = { ok: true } | { ok: false; message: string };

/**
 * Deletes the signed-in user's account. Files are removed first (storage rows
 * do not cascade); the database then cascades everything the user owns. A
 * trainer's workspace and their students' records go with it.
 */
export async function deleteAccount(confirmation: string): Promise<AccountResult> {
  const user = await requireUser();
  if (confirmation.trim().toUpperCase() !== "EXCLUIR") return { ok: false, message: "Digite EXCLUIR para confirmar." };
  const supabase = await createClient();

  if (user.avatarPath) await supabase.storage.from("avatars").remove([user.avatarPath]);
  if (user.role === "student") {
    const { data: photos } = await supabase.from("progress_photos").select("storage_path").eq("student_id", user.id);
    if (photos?.length) await supabase.storage.from("progress-photos").remove(photos.map((p) => p.storage_path));
  } else if (user.workspace?.role === "owner") {
    const workspaceId = user.workspace.id;
    const [{ data: photos }, { data: videos }] = await Promise.all([
      supabase.from("progress_photos").select("storage_path").eq("workspace_id", workspaceId),
      supabase.storage.from("exercise-videos").list(workspaceId, { limit: 1000 }),
    ]);
    if (photos?.length) await supabase.storage.from("progress-photos").remove(photos.map((p) => p.storage_path));
    if (videos?.length) await supabase.storage.from("exercise-videos").remove(videos.map((v) => `${workspaceId}/${v.name}`));
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, message: "Não foi possível excluir a conta. Tente novamente." };
  await supabase.auth.signOut();
  redirect("/login?conta=excluida");
}

const bodyProfileSchema = z.object({
  sex: z.enum(["", "female", "male"], { error: "Selecione uma opção válida." }).transform((v) => (v === "" ? null : v)),
  heightCm: studentProfileSchema.shape.heightCm,
  birthDate: studentProfileSchema.shape.birthDate,
});

/** Students keep their own sex, height and birth date up to date (used by the body assessment). */
export async function updateMyBodyProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = { sex: formString(formData, "sex"), heightCm: formString(formData, "heightCm"), birthDate: formString(formData, "birthDate") };
  if (user.role !== "student") return { status: "error", message: SAVE_ERROR, values };
  const parsed = bodyProfileSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  // Generated RPC types mark every argument as non-null; null clears the value.
  const { error } = await supabase.rpc("update_my_body_profile", {
    p_sex: parsed.data.sex as "female" | "male",
    p_height_cm: parsed.data.heightCm as number,
    p_birth_date: parsed.data.birthDate as string,
  });
  if (error) return { status: "error", message: SAVE_ERROR, values };
  refresh();
  return { status: "success", message: "Dados atualizados.", values };
}
