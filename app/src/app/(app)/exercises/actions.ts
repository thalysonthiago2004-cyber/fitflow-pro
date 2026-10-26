"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { createClient } from "@/lib/supabase/server";
import { exerciseSchema } from "@/lib/workouts/schemas";

const DUPLICATE = "Já existe um exercício com este nome na sua biblioteca.";

function readExercise(formData: FormData) {
  return {
    name: formString(formData, "name"),
    muscleGroup: formString(formData, "muscleGroup"),
    equipment: formString(formData, "equipment"),
    instructions: formString(formData, "instructions"),
    videoUrl: formString(formData, "videoUrl"),
  };
}

export async function createExercise(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = readExercise(formData);
  const parsed = exerciseSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      workspace_id: user.workspace.id,
      name: parsed.data.name,
      muscle_group: parsed.data.muscleGroup,
      equipment: parsed.data.equipment,
      instructions: parsed.data.instructions,
      video_url: parsed.data.videoUrl,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: error.code === "23505" ? DUPLICATE : GENERIC_DB_ERROR, values };

  redirect(`/exercises/${data.id}`);
}

export async function updateExercise(exerciseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = readExercise(formData);
  if (!z.uuid().safeParse(exerciseId).success) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = exerciseSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({
      name: parsed.data.name,
      muscle_group: parsed.data.muscleGroup,
      equipment: parsed.data.equipment,
      instructions: parsed.data.instructions,
      video_url: parsed.data.videoUrl,
    })
    .eq("id", exerciseId)
    .eq("workspace_id", user.workspace.id)
    .select("id");
  if (error || !data?.length) {
    return { status: "error", message: error?.code === "23505" ? DUPLICATE : GENERIC_DB_ERROR, values };
  }

  refresh();
  return { status: "success", message: "Exercício atualizado.", values };
}

// Archiving keeps the exercise inside existing plans and logs, but hides it
// from the library and from new prescriptions.
export async function archiveExercise(exerciseId: string): Promise<{ ok: false; message: string }> {
  const user = await requireStaff();
  if (!z.uuid().safeParse(exerciseId).success) return { ok: false, message: GENERIC_DB_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({ archived: true })
    .eq("id", exerciseId)
    .eq("workspace_id", user.workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };

  redirect("/exercises");
}

// Videos and customizations ----------------------------------------------------
// Own exercises keep their video on the exercise row. Global exercises are
// never changed: the workspace gets a customization with its own instructions
// and video instead. Files live under `<workspace id>/` in `exercise-videos`.

export type VideoResult = { ok: true } | { ok: false; message: string };
export type UploadTicket = { ok: true; path: string; signedUrl: string } | { ok: false; message: string };

const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

type Ctx = NonNullable<Awaited<ReturnType<typeof editableExercise>>>;

// Updates the workspace's customization, or creates it. (A plain upsert would
// also try to update the key columns, which clients may not change.)
function writeCustomization(ctx: Ctx, values: { instructions: string | null; video_url: string | null; video_path: string | null }) {
  const row = { ...values, updated_by: ctx.user.id };
  return ctx.custom
    ? ctx.supabase.from("exercise_customizations").update(row).eq("workspace_id", ctx.user.workspace.id).eq("exercise_id", ctx.exercise.id)
    : ctx.supabase.from("exercise_customizations").insert({ ...row, workspace_id: ctx.user.workspace.id, exercise_id: ctx.exercise.id });
}

async function editableExercise(exerciseId: string) {
  const user = await requireStaff();
  if (!z.uuid().safeParse(exerciseId).success) return null;
  const supabase = await createClient();
  const { data: exercise } = await supabase.from("exercises").select("id, workspace_id, instructions, video_url, video_path").eq("id", exerciseId).maybeSingle();
  if (!exercise || (exercise.workspace_id !== null && exercise.workspace_id !== user.workspace.id)) return null;
  const { data: custom } = exercise.workspace_id === null
    ? await supabase.from("exercise_customizations").select("instructions, video_url, video_path").eq("workspace_id", user.workspace.id).eq("exercise_id", exerciseId).maybeSingle()
    : { data: null };
  return { user, supabase, exercise, custom, isGlobal: exercise.workspace_id === null };
}

const ORPHAN_AGE_MS = 3 * 60 * 60 * 1000;

/**
 * Removes this workspace's uploaded videos that no exercise or customization
 * points at (an upload that never got attached, or a replaced file whose
 * removal failed). Files younger than 3 h are kept: they may be mid-upload.
 */
async function removeOrphanVideos(ctx: Ctx) {
  const workspaceId = ctx.user.workspace.id;
  const [{ data: files }, { data: own }, { data: custom }] = await Promise.all([
    ctx.supabase.storage.from("exercise-videos").list(workspaceId, { limit: 1000 }),
    ctx.supabase.from("exercises").select("video_path").eq("workspace_id", workspaceId).not("video_path", "is", null),
    ctx.supabase.from("exercise_customizations").select("video_path").eq("workspace_id", workspaceId).not("video_path", "is", null),
  ]);
  if (!files) return;
  const used = new Set([...(own ?? []), ...(custom ?? [])].map((r) => r.video_path));
  const cutoff = Date.now() - ORPHAN_AGE_MS;
  const orphans = files
    .filter((f) => f.created_at && Date.parse(f.created_at) < cutoff)
    .map((f) => `${workspaceId}/${f.name}`)
    .filter((path) => !used.has(path));
  if (orphans.length) await ctx.supabase.storage.from("exercise-videos").remove(orphans);
}

/** Step 1: a one-time signed URL the browser uploads the video to directly (no size limit from server actions). */
export async function requestVideoUpload(exerciseId: string, contentType: string, size: number): Promise<UploadTicket> {
  const ctx = await editableExercise(exerciseId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const ext = VIDEO_TYPES[contentType];
  if (!ext) return { ok: false, message: "Formato não suportado. Envie um vídeo MP4, MOV ou WebM." };
  if (!Number.isFinite(size) || size <= 0 || size > VIDEO_MAX_BYTES) return { ok: false, message: "O vídeo pode ter no máximo 50 MB. Grave um trecho mais curto." };

  await removeOrphanVideos(ctx);
  const path = `${ctx.user.workspace.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await ctx.supabase.storage.from("exercise-videos").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: "Não foi possível preparar o envio. Tente novamente." };
  return { ok: true, path, signedUrl: data.signedUrl };
}

/** Step 2: after the upload, points the exercise (or the workspace's customization) at the new file. */
export async function attachVideo(exerciseId: string, path: string): Promise<VideoResult> {
  const ctx = await editableExercise(exerciseId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const folder = `${ctx.user.workspace.id}/`;
  if (!path.startsWith(folder) || !/^[0-9a-f-]{36}\.(mp4|webm|mov)$/.test(path.slice(folder.length))) return { ok: false, message: GENERIC_DB_ERROR };
  // The file must really be there before anything points at it.
  const { error: missing } = await ctx.supabase.storage.from("exercise-videos").createSignedUrl(path, 60);
  if (missing) return { ok: false, message: "O envio não terminou. Tente de novo." };

  const previous = ctx.isGlobal ? ctx.custom?.video_path : ctx.exercise.video_path;
  const { error } = ctx.isGlobal
    ? await writeCustomization(ctx, {
        instructions: ctx.custom ? ctx.custom.instructions : ctx.exercise.instructions,
        video_url: ctx.custom ? ctx.custom.video_url : ctx.exercise.video_url,
        video_path: path,
      })
    : await ctx.supabase.from("exercises").update({ video_path: path }).eq("id", exerciseId);
  if (error) {
    await ctx.supabase.storage.from("exercise-videos").remove([path]);
    return { ok: false, message: GENERIC_DB_ERROR };
  }
  if (previous) await ctx.supabase.storage.from("exercise-videos").remove([previous]);
  refresh();
  return { ok: true };
}

export async function removeVideo(exerciseId: string): Promise<VideoResult> {
  const ctx = await editableExercise(exerciseId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const previous = ctx.isGlobal ? ctx.custom?.video_path : ctx.exercise.video_path;
  if (!previous) return { ok: true };
  const { error } = ctx.isGlobal
    ? await ctx.supabase.from("exercise_customizations").update({ video_path: null, updated_by: ctx.user.id }).eq("workspace_id", ctx.user.workspace.id).eq("exercise_id", exerciseId)
    : await ctx.supabase.from("exercises").update({ video_path: null }).eq("id", exerciseId);
  if (error) return { ok: false, message: GENERIC_DB_ERROR };
  await ctx.supabase.storage.from("exercise-videos").remove([previous]);
  refresh();
  return { ok: true };
}

const customizationSchema = exerciseSchema.pick({ instructions: true, videoUrl: true });

/** Instructions and video link a workspace shows for a global exercise. */
export async function saveCustomization(exerciseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = { instructions: formString(formData, "instructions"), videoUrl: formString(formData, "videoUrl") };
  const ctx = await editableExercise(exerciseId);
  if (!ctx?.isGlobal) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = customizationSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { error } = await writeCustomization(ctx, {
    instructions: parsed.data.instructions,
    video_url: parsed.data.videoUrl,
    video_path: ctx.custom?.video_path ?? null,
  });
  if (error) return { status: "error", message: GENERIC_DB_ERROR, values };
  refresh();
  return { status: "success", message: "Personalização salva. Seus alunos já veem esta versão.", values };
}

/** Back to the catalog's instructions, removing the workspace's video too. */
export async function resetCustomization(exerciseId: string): Promise<VideoResult> {
  const ctx = await editableExercise(exerciseId);
  if (!ctx?.isGlobal || !ctx.custom) return { ok: false, message: GENERIC_DB_ERROR };
  const { error } = await ctx.supabase.from("exercise_customizations").delete().eq("workspace_id", ctx.user.workspace.id).eq("exercise_id", exerciseId);
  if (error) return { ok: false, message: GENERIC_DB_ERROR };
  if (ctx.custom.video_path) await ctx.supabase.storage.from("exercise-videos").remove([ctx.custom.video_path]);
  refresh();
  return { ok: true };
}
