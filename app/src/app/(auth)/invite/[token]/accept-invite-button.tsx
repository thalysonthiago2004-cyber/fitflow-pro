"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { acceptInvite } from "../../actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4"
      action={() =>
        startTransition(async () => {
          const result = await acceptInvite(token);
          setError(result.message);
        })
      }
    >
      {error && <FormMessage state={{ status: "error", message: error }} />}
      <SubmitButton pending={pending} pendingLabel="Aceitando…" className="w-full">
        Aceitar convite
      </SubmitButton>
    </form>
  );
}
