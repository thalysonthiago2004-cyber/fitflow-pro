"use client";

import { BellRing } from "lucide-react";
import { useActionState, useReducer, useSyncExternalStore } from "react";
import { saveReminders } from "@/app/(app)/hydration/actions";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";
import { INTERVAL_OPTIONS } from "@/lib/hydration/schemas";
import type { ReminderPrefs } from "@/lib/hydration/queries";

type Permission = NotificationPermission | "unsupported";

const noopSubscribe = () => () => {};
const readPermission = (): Permission => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

export function ReminderSettings({ prefs }: { prefs: ReminderPrefs }) {
  const [state, action, pending] = useActionState(saveReminders, initialFormState);
  // The browser has no permission-change event we can rely on everywhere, so
  // re-read the snapshot after asking.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const permission = useSyncExternalStore(noopSubscribe, readPermission, () => "default" as Permission);

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" name="enabled" defaultChecked={prefs.enabled} className="size-5 accent-[var(--primary)]" />
        <span className="text-sm font-medium">Lembrar de beber água</span>
      </label>
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField name="startTime" label="Das" type="time" defaultValue={state.values?.startTime ?? prefs.startTime} errors={state.fieldErrors?.startTime} />
        <FormField name="endTime" label="Até" type="time" defaultValue={state.values?.endTime ?? prefs.endTime} errors={state.fieldErrors?.endTime} />
        <SelectField
          name="intervalMinutes"
          label="Frequência"
          options={INTERVAL_OPTIONS}
          defaultValue={state.values?.intervalMinutes ?? String(prefs.intervalMinutes)}
          errors={state.fieldErrors?.intervalMinutes}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Os lembretes aparecem enquanto o FitFlow Pro estiver aberto no navegador. Eles param quando você atinge a meta do dia.
      </p>
      {permission === "default" && (
        <Button type="button" variant="outline" className="sm:justify-self-start" onClick={() => Notification.requestPermission().then(rerender)}>
          <BellRing aria-hidden />
          Permitir notificações do navegador
        </Button>
      )}
      {permission === "denied" && (
        <p className="text-sm text-muted-foreground">As notificações estão bloqueadas no navegador. Os lembretes aparecem dentro do app.</p>
      )}
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">
        Salvar lembretes
      </SubmitButton>
    </form>
  );
}
