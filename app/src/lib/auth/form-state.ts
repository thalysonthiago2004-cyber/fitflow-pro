import { z } from "zod";
import type { FormState } from "./schemas";

// Converts a failed Zod parse into form state. `values` must never include passwords.
export function validationError(error: z.ZodError, values?: Record<string, string>): FormState {
  return {
    status: "error",
    message: "Revise os campos destacados.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values,
  };
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
