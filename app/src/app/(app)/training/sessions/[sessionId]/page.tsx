import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ChevronDown, HeartPulse, Layers } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ExerciseDemo } from "@/components/workouts/exercise-demo";
import { formatPrescription, formatRest, formatWeekdays, groupSupersets, supersetLabel } from "@/lib/workouts/labels";
import { type Prescription, getOpenLog, getStudentPlans } from "@/lib/workouts/queries";
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
        {groupSupersets(session.exercises).map((block) => {
          const cards = block.map((item) => <ItemCard key={item.id} item={item} index={session.exercises.indexOf(item)} inGroup={block.length > 1} />);
          if (block.length === 1) return cards;
          const last = block.at(-1)!;
          const rest = last.kind === "strength" ? formatRest(last.restSeconds) : null;
          return (
            <li key={block[0].id} className="grid gap-3 rounded-2xl border-2 border-foreground/15 bg-muted/40 p-2 sm:p-3">
              <div className="grid gap-0.5 px-2 pt-1">
                <p className="flex items-center gap-2 font-semibold">
                  <Layers className="size-4" aria-hidden />
                  {supersetLabel(block.length)}: {block.map((i) => i.exercise.name).join(" + ")}
                </p>
                <p className="text-sm text-muted-foreground">Faça os exercícios em sequência, sem pausa entre eles{rest ? `, e descanse ${rest} ao fim de cada volta` : ""}.</p>
              </div>
              <ol className="grid gap-3">{cards}</ol>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ItemCard({ item, index, inGroup }: { item: Prescription; index: number; inGroup: boolean }) {
  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums" aria-hidden>{index + 1}</span>
        <div className="grid gap-0.5">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold">
            {item.exercise.name}
            {item.kind === "cardio" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <HeartPulse className="size-3.5" aria-hidden />
                Cardio
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">{formatPrescription(item, { withRest: !inGroup })}</p>
          {item.notes && <p className="text-sm">{item.notes}</p>}
        </div>
      </div>
      <details className="group rounded-lg bg-muted/50">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Como executar
          <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <div className="px-3 pb-3">
          <ExerciseDemo name={item.exercise.name} instructions={item.exercise.instructions} videoUrl={item.exercise.videoUrl} videoSrc={item.exercise.videoSrc} />
        </div>
      </details>
    </li>
  );
}

export default function TrainingSessionPage({ params }: PageProps<"/training/sessions/[sessionId]">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/training" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Meus treinos
      </Link>
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando treino" />}>
        <SessionContent params={params} />
      </Suspense>
    </div>
  );
}
