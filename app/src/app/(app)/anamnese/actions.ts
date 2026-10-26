"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { PARQ_DETAILS, PARQ_QUESTIONS, parqSchema } from "@/lib/students/parq";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { notifyActivity } from "@/lib/push/notify";
import { createClient } from "@/lib/supabase/server";

// Each submission is kept, so the trainer sees when answers changed.
export async function submitQuestionnaire(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = Object.fromEntries([...PARQ_QUESTIONS, ...PARQ_DETAILS].map(({ key }) => [key, formString(formData, key)]));
  if (user.role !== "student" || !user.workspace) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = parqSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("health_questionnaires").insert({
    workspace_id: user.workspace.id,
    student_id: user.id,
    answers: parsed.data.answers,
    needs_clearance: parsed.data.needsClearance,
  });
  if (error) return { status: "error", message: GENERIC_DB_ERROR, values };
  const workspaceId = user.workspace.id;
  after(() => notifyActivity({ type: "questionnaire", workspaceId, studentId: user.id, needsClearance: parsed.data.needsClearance }));
  redirect("/anamnese?enviado=1");
}
