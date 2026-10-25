import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ExerciseDemo } from "@/components/workouts/exercise-demo";
import { formatNumber } from "@/lib/format";
import { formatReps, formatRest, formatWeekdays } from "@/lib/workouts/labels";
import { getOpenLog, getStudentPlans } from "@/lib/workouts/queries";
import { StartWorkoutButton } from "../../start-workout-button";
import { requireStudent } from "../../require-student";

export const metadata: Metadata = { title: "Treino" };

async function SessionContent({ params }: Pick<PageProps<"/training/sessions/[sessionId]">, "params">) {
  const { sessionId } = await params;
  const user = await requireStudent();
  const [plans, openLog] = await Promise.all([getStudentPlans(user.id), getOpenLog(user.id)]);
  const plan = plans.find((p) => p.sessions.some((s) => s.id === sessionId));
  const session = plan?.sessions.find((s) => s.id === sessionId);
  if (!plan || !session) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader title={session.name} description={`${plan.name} · ${formatWeekdays(session.weekdays)}`} />

      {openLog ? (
        <Link href={`/training/log/${openLog.id}`} className={buttonVariants({ size: "lg", className: "sm:justify-self-start" })}>
          Continuar treino em andamento ({openLog.sessionName})
        </Link>
      ) : session.exercises.length > 0 ? (
        <StartWorkoutButton sessionId={session.id} className="sm:justify-self-start" />
      ) : null}

      {plan.notes && <p className="rounded-xl border bg-card p-4 text-sm whitespace-pre-line">{plan.notes}</p>}

      <ol className="grid gap-3">
        {session.exercises.map((item, index) => (
          <li key={item.id} className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums" aria-hidden>{index + 1}</span>
              <div className="grid gap-0.5">
                <h2 className="font-semibold">{item.exercise.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {item.sets} séries × {formatReps(item.repsMin, item.repsMax)} reps
                  {item.loadKg !== null && ` · ${formatNumber(item.loadKg, 2)} kg`}
                  {item.restSeconds ? ` · descanso ${formatRest(item.restSeconds)}` : ""}
                </p>
                {item.notes && <p className="text-sm">{item.notes}</p>}
              </div>
            </div>
            <details className="group rounded-lg bg-muted/50">
              <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                Como executar
                <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <div className="px-3 pb-3">
                <ExerciseDemo name={item.exercise.name} instructions={item.exercise.instructions} videoUrl={item.exercise.videoUrl} />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function TrainingSessionPage({ params }: PageProps<"/training/sessions/[sessionId]">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/training" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Meus treinos
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando treino" />}>
        <SessionContent params={params} />
      </Suspense>
    </div>
  );
}
