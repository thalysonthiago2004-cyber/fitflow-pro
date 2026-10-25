"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { InviteLinkPanel } from "@/components/invite-link-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { type InviteState, inviteStudent } from "../actions";

const initial: InviteState = { status: "idle" };

export function InviteForm() {
  // Remounting the form resets the action state for a new invitation.
  const [round, setRound] = useState(0);
  return <InviteFormRound key={round} onAnother={() => setRound((r) => r + 1)} />;
}

function InviteFormRound({ onAnother }: { onAnother: () => void }) {
  const [state, action, pending] = useActionState(inviteStudent, initial);

  if (state.status === "success" && state.inviteUrl) {
    return (
      <div className="grid gap-6">
        <FormMessage state={state} />
        <InviteLinkPanel url={state.inviteUrl} expiresAt={state.expiresAt} studentName={state.values?.fullName} />
        <div className="flex flex-col gap-2 border-t pt-6 sm:flex-row">
          <Button variant="secondary" onClick={onAnother}>
            Convidar outro aluno
          </Button>
          <Link href="/students?view=invites" className={buttonVariants({ variant: "ghost" })}>
            Ver convites pendentes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField
        name="fullName"
        label="Nome do aluno"
        autoComplete="off"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
      <FormField
        name="email"
        label="E-mail do aluno"
        type="email"
        inputMode="email"
        autoComplete="off"
        required
        hint="O aluno vai criar a conta com este e-mail."
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton pending={pending} pendingLabel="Gerando convite…" className="sm:justify-self-start">
        Gerar link de convite
      </SubmitButton>
    </form>
  );
}
