import { CircleCheck, CircleDashed } from "lucide-react";
import Link from "next/link";

export type OnboardingStep = { done: boolean; label: string; hint: string; href: string };

// Getting-started list for new trainers. Each step comes from real account
// state, so it disappears on its own once everything is done.
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section aria-labelledby="onboarding-title" className="grid gap-4 surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="onboarding-title" className="font-heading text-lg font-bold">Primeiros passos</h2>
        <span className="text-sm text-muted-foreground tabular-nums">{done} de {steps.length} concluídos</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--meter-track)]" role="progressbar" aria-label="Primeiros passos concluídos" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
        <div className="h-full rounded-full bg-[var(--meter-fill)]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-2">
        {steps.map((step) => (
          <li key={step.label}>
            {step.done ? (
              <p className="flex items-center gap-3 rounded-xl p-2 text-sm text-muted-foreground">
                <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
                <span className="line-through">{step.label}</span>
                <span className="sr-only">(concluído)</span>
              </p>
            ) : (
              <Link href={step.href} className="flex items-center gap-3 rounded-xl border p-3 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                <CircleDashed className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="grid min-w-0">
                  <span className="font-medium">{step.label}</span>
                  <span className="text-sm text-muted-foreground">{step.hint}</span>
                </span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
