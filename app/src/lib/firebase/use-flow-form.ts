"use client";

import { useState, useTransition } from "react";
import { type FormState, initialFormState } from "@/lib/auth/schemas";
import type { FlowResult } from "./flows";

const REVIEW = "Revise os campos destacados.";

/**
 * Form state for the Firebase flows, shaped like the server-action forms
 * (FormState) so FormMessage and FormField keep working unchanged. On success
 * it does a full navigation, so the new session cookies are used everywhere.
 */
export function useFlowForm() {
  const [state, setState] = useState<FormState>(initialFormState);
  const [unverified, setUnverified] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(values: Record<string, string>, task: () => Promise<FlowResult>, verifyMessage?: (email: string) => string) {
    startTransition(async () => {
      const result = await task();
      if (result.ok && "redirectTo" in result) {
        setNavigating(true);
        window.location.assign(result.redirectTo);
        return;
      }
      if (result.ok) {
        setState({ status: "success", message: verifyMessage?.(result.email) ?? "" });
        return;
      }
      setUnverified(Boolean(result.unverified));
      setState(
        result.field
          ? { status: "error", message: REVIEW, fieldErrors: { [result.field]: [result.message] }, values }
          : { status: "error", message: result.message, values },
      );
    });
  }

  return { state, setState, unverified, pending: pending || navigating, run };
}
