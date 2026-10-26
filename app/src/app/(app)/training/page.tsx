import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Dumbbell, History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, weekdayToday } from "@/lib/format";
import { formatWeekdays } from "@/lib/workouts/labels";
import { getOpenLog, getStudentPlans, listLogs } from "@/lib/workouts/queries";
import { WorkoutHeroCard } from "@/components/workouts/workout-hero-card";
import { requireStudent } from "./require-student";

export const metadata: Metadata = { title: "Meus treinos" };

async function TrainingContent() {
  const user = await requireStudent();
  const [plans, openLog, recent] = await Promise.all([
    getStudentPlans(user.id),
    getOpenLog(user.id),
    listLogs({ studentId: user.id, completedOnly: true, limit: 5 }),
  ]);
  const today = weekdayToday();
  const all = plans.flatMap((p) => p.sessions).filter((s) => s.exercises.length > 0);
  const featured = openLog
    ? all.find((s) => s.id === openLog.sessionId)
    : all.find((s) => s.weekdays.includes(today)) ?? all.find((s) => s.weekdays.length === 0);

  return (
    <div className="grid gap-8">
      {featured && (
        <WorkoutHeroCard
          session={featured}
          eyebrow={openLog ? "Em andamento" : featured.weekdays.includes(today) ? "Treino de hoje" : "Disponível hoje"}
          href={openLog ? `/training/log/${openLog.id}` : `/training/sessions/${featured.id}`}
          cta={openLog ? "Continuar treino" : "Iniciar"}
          inProgress={Boolean(openLog)}
        />
      )}

      {plans.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Nenhum plano de treino ainda"
          description="Quando seu personal publicar um plano, ele aparece aqui."
        />
      ) : (
        plans.map((plan) => (
          <section key={plan.id} aria-labelledby={`plan-${plan.id}`} className="grid gap-4">
            <div className="grid gap-1">
              <h2 id={`plan-${plan.id}`} className="font-heading text-xl font-semibold">{plan.name}</h2>
              {(plan.startsOn || plan.endsOn) && (
                <p className="text-sm text-muted-foreground">
                  {plan.startsOn && `De ${formatDate(plan.startsOn)}`} {plan.endsOn && `até ${formatDate(plan.endsOn)}`}
                </p>
              )}
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {plan.sessions.map((session) => {
                const isToday = session.weekdays.includes(today);
                const anyDay = session.weekdays.length === 0;
                return (
                  <li key={session.id}>
                    <Link
                      href={`/training/sessions/${session.id}`}
                      className="flex h-full items-center gap-3 rounded-2xl border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <div className="grid min-w-0 flex-1 gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{session.name}</span>
                          {isToday && <StatusBadge tone="success">Hoje</StatusBadge>}
                          {anyDay && <StatusBadge tone="info">Qualquer dia</StatusBadge>}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {session.exercises.length} {session.exercises.length === 1 ? "exercício" : "exercícios"} · {formatWeekdays(session.weekdays)}
                        </span>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <section aria-labelledby="recent-title" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-title" className="font-heading text-xl font-semibold">Últimos treinos</h2>
          {recent.length > 0 && (
            <Link href="/training/history" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <History aria-hidden />
              Ver histórico
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Os treinos que você concluir aparecem aqui.</p>
        ) : (
          <ul className="grid gap-2">
            {recent.map((log) => (
              <li key={log.id}>
                <Link href={`/training/log/${log.id}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="font-medium">{log.sessionName}</span>
                  <span className="text-muted-foreground tabular-nums">{formatDate(log.completedAt ?? log.startedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function TrainingPage() {
  return (
    <div className="grid gap-8">
      <PageHeader title="Meus treinos" description="Seu plano atual e o histórico de treinos." />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando treinos" />}>
        <TrainingContent />
      </Suspense>
    </div>
  );
}
