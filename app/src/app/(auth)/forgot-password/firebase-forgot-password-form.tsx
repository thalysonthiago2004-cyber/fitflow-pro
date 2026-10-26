"use client";

import { useState, useTransition } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { formString, validationError } from "@/lib/auth/form-state";
import { type FormState, forgotPasswordSchema, initialFormState } from "@/lib/auth/schemas";
import { passwordResetFlow } from "@/lib/firebase/flows";

export function FirebaseForgotPasswordForm() {
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const email = formString(formData, "email");
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return setState(validationError(parsed.error, { email }));
    startTransition(async () => {
      const result = await passwordResetFlow(parsed.data.email);
      setState(
        result.ok
          ? { status: "success", message: "Se houver uma conta com este e-mail, você receberá um link para redefinir a senha." }
          : { status: "error", message: result.message, values: { email } },
      );
    });
  }

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={submit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton pending={pending} pendingLabel="Enviando…" className="w-full">
        Enviar link
      </SubmitButton>
    </form>
  );
}
