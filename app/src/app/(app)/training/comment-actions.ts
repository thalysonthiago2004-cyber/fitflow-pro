"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { formString } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { createClient } from "@/lib/supabase/server";

const id = z.uuid();

// Whoever can see the workout (its student or their trainer) can comment;
// RLS enforces it. The author is always the signed-in user.
export async function addComment(logId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = formString(formData, "body").trim();
  if (!id.safeParse(logId).success) return { status: "error", message: GENERIC_DB_ERROR };
  if (!body) return { status: "error", message: "Revise os campos destacados.", fieldErrors: { body: ["Escreva um comentário."] }, values: { body } };
  if (body.length > 1000) return { status: "error", message: "Revise os campos destacados.", fieldErrors: { body: ["Use no máximo 1000 caracteres."] }, values: { body } };

  const supabase = await createClient();
  const { error } = await supabase.from("workout_comments").insert({ log_id: logId, author_id: user.id, body });
  if (error) return { status: "error", message: GENERIC_DB_ERROR, values: { body } };
  refresh();
  return { status: "success", message: "Comentário enviado." };
}

export async function deleteComment(commentId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!id.safeParse(commentId).success) return { ok: false, message: GENERIC_DB_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_comments").delete().eq("id", commentId).eq("author_id", user.id).select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };
  refresh();
  return { ok: true };
}
