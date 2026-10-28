import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { listStudents } from "@/lib/students/queries";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "@/lib/workouts/labels";
import { getPlan, listExercises } from "@/lib/workouts/queries";
import { AddSessionForm } from "./add-session-form";
import { PlanDetailsForm } from "./plan-details-form";
import { PlanActions } from "./plan-actions";
import { SessionCard } from "./session-card";

export const metadata: Metadata = { title: "Plano de treino" };

const UUID = /^[0-9a-f-]{36}$/i;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

async function PlanBuilder({ params }: Pick<PageProps<"/workouts/[planId]">, "params">) {
  const { planId } = await params;
  if (!UUID.test(planId)) notFound();
  const user = await requireStaff();
  const [plan, exercises, students] = await Promise.all([getPlan(planId), listExercises(), listStudents(user.workspace.id)]);
  if (!plan || plan.workspaceId !== user.workspace.id) notFound();

  const pickable = exercises.map(({ id, name, muscleGroup }) => ({ id, name, muscleGroup }));
  const suggestedName = `Treino ${LETTERS[plan.sessions.length] ?? plan.sessions.length + 1}`;
  const period = plan.startsOn || plan.endsOn ? [plan.startsOn && `de ${formatDate(plan.startsOn)}`, plan.endsOn && `até ${formatDate(plan.endsOn)}`].filter(Boolean).join(" ") : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        title={plan.name}
        description={
          plan.studentId ? (
            <>
              Aluno:{" "}
              <Link href={`/students/${plan.studentId}`} className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
                {plan.studentName}
              </Link>
            </>
          ) : (
            "Modelo de treino: use para criar planos de alunos em um clique."
          )
        }
        eyebrow={
          <span className="inline-flex items-center gap-2 normal-case">
            {plan.isTemplate ? <StatusBadge tone="info">Modelo</StatusBadge> : <StatusBadge tone={PLAN_STATUS_TONES[plan.status]}>{PLAN_STATUS_LABELS[plan.status]}</StatusBadge>}
            {period && <span className="tracking-normal tabular-nums">{period}</span>}
          </span>
        }
        actions={
          <PlanActions
            planId={plan.id}
            planName={plan.name}
            status={plan.status}
            studentName={plan.studentName}
            isTemplate={plan.isTemplate}
            students={students.filter((s) => s.status === "active").map((s) => ({ id: s.userId, name: s.fullName }))}
          />
        }
      />

      {plan.status === "draft" && !plan.isTemplate && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          Este plano é um rascunho e ainda não aparece para o aluno. Publique quando estiver pronto.
        </p>
      )}

      <section aria-labelledby="sessions-title" className="grid gap-4">
        <h2 id="sessions-title" className="font-heading text-xl font-semibold">Treinos</h2>
        {plan.sessions.map((session, index) => (
          <SessionCard key={session.id} session={session} index={index} total={plan.sessions.length} exercises={pickable} />
        ))}
        <AddSessionForm planId={plan.id} suggestedName={suggestedName} />
      </section>

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Detalhes do plano</h2></CardTitle>
          <CardDescription>Nome, período e orientações gerais.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlanDetailsForm plan={plan} />
        </CardContent>
      </Card>

    </div>
  );
}

export default function PlanPage({ params }: PageProps<"/workouts/[planId]">) {
  return (
    <div className="grid max-w-4xl gap-6">
      <BackLink href="/workouts">Planos de treino</BackLink>
      <Suspense fallback={<div role="status" className="h-[32rem] animate-pulse rounded-2xl bg-muted" aria-label="Carregando plano" />}>
        <PlanBuilder params={params} />
      </Suspense>
    </div>
  );
}
