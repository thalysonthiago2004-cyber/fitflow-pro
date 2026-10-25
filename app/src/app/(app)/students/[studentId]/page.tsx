import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight, Plus, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/dal";
import { ageFromBirthDate, formatDate, formatDuration, formatNumber } from "@/lib/format";
import { getStudent } from "@/lib/students/queries";
import { EXPERIENCE_LEVEL_LABELS, STUDENT_STATUS_LABELS } from "@/lib/students/schemas";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "@/lib/workouts/labels";
import { listLogs, listPlans } from "@/lib/workouts/queries";
import { WeekChart } from "@/components/hydration/week-chart";
import { getCurrentGoal, getDailyTotals } from "@/lib/hydration/queries";
import { HydrationGoalForm } from "./hydration-goal-form";
import { listMealPlans } from "@/lib/nutrition/queries";
import { StudentProfileForm } from "./student-profile-form";
import { StudentStatusActions } from "./student-status-actions";

export const metadata: Metadata = { title: "Aluno" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

async function StudentContent({ params }: Pick<PageProps<"/students/[studentId]">, "params">) {
  const { studentId } = await params;
  if (!UUID.test(studentId)) notFound();
  const user = await requireStaff();
  const student = await getStudent(user.workspace.id, studentId);
  if (!student) notFound();
  const [plans, logs, goalMl, waterDays, mealPlans] = await Promise.all([
    listPlans({ workspaceId: user.workspace.id, studentId }),
    listLogs({ workspaceId: user.workspace.id, studentId, limit: 10 }),
    getCurrentGoal(studentId),
    getDailyTotals(studentId, 7),
    listMealPlans({ workspaceId: user.workspace.id, studentId }),
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={student.fullName}
        description={student.email}
        actions={
          <>
            <StatusBadge tone={student.status === "active" ? "success" : "neutral"}>
              {STUDENT_STATUS_LABELS[student.status]}
            </StatusBadge>
            <Link href={`/students/${student.userId}/progress`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <TrendingUp aria-hidden />
              Evolução
            </Link>
          </>
        }
      />

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label="Aluno desde" value={formatDate(student.joinedAt)} />
            <Fact label="Nível" value={student.experienceLevel ? EXPERIENCE_LEVEL_LABELS[student.experienceLevel] : "Não informado"} />
            <Fact label="Idade" value={student.birthDate ? `${ageFromBirthDate(student.birthDate)} anos` : "Não informada"} />
            <Fact label="Altura" value={student.heightCm !== null ? `${formatNumber(student.heightCm)} cm` : "Não informada"} />
          </dl>
        </CardContent>
      </Card>

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <h2>Planos de treino</h2>
          </CardTitle>
          <CardAction>
            <Link href={`/workouts/new?student=${student.userId}`} aria-label="Novo plano de treino" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Plus aria-hidden />
              Novo plano
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum plano criado para este aluno.</p>
          ) : (
            <ul className="grid gap-2">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <Link href={`/workouts/${plan.id}`} className="flex items-center gap-3 rounded-lg border px-4 py-3 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="flex-1 truncate font-medium">{plan.name}</span>
                    <StatusBadge tone={PLAN_STATUS_TONES[plan.status]}>{PLAN_STATUS_LABELS[plan.status]}</StatusBadge>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <h2>Planos alimentares</h2>
          </CardTitle>
          <CardAction>
            <Link href={`/nutrition/new?student=${student.userId}`} aria-label="Novo plano alimentar" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Plus aria-hidden />
              Novo plano
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {mealPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum plano alimentar criado para este aluno.</p>
          ) : (
            <ul className="grid gap-2">
              {mealPlans.map((plan) => (
                <li key={plan.id}>
                  <Link href={`/nutrition/${plan.id}`} className="flex items-center gap-3 rounded-lg border px-4 py-3 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="flex-1 truncate font-medium">{plan.name}</span>
                    <StatusBadge tone={PLAN_STATUS_TONES[plan.status]}>{PLAN_STATUS_LABELS[plan.status]}</StatusBadge>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <h2>Treinos realizados</h2>
          </CardTitle>
          <CardDescription>Registrados pelo aluno. Últimos 10.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">O aluno ainda não registrou treinos.</p>
          ) : (
            <ul className="grid gap-2">
              {logs.map((log) => (
                <li key={log.id}>
                  <Link href={`/students/${student.userId}/logs/${log.id}`} className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="flex-1 font-medium">{log.sessionName}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatDate(log.startedAt)}
                      {log.completedAt ? ` · ${formatDuration(log.startedAt, log.completedAt)}` : " · em andamento"}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <h2>Hidratação</h2>
          </CardTitle>
          <CardDescription>Meta configurada por você como referência; não é prescrição médica. Os registros são feitos pelo aluno.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <HydrationGoalForm studentId={student.userId} goalMl={goalMl} />
          <WeekChart days={waterDays} goalMl={goalMl} title="Consumo nos últimos 7 dias" />
        </CardContent>
      </Card>

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <h2>Dados de acompanhamento</h2>
          </CardTitle>
          <CardDescription>Visíveis para você e para o aluno.</CardDescription>
        </CardHeader>
        <CardContent>
          <StudentProfileForm student={student} />
        </CardContent>
      </Card>

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <h2>Gerenciar vínculo</h2>
          </CardTitle>
          <CardDescription>Arquive para pausar o acompanhamento ou remova para encerrar o vínculo.</CardDescription>
        </CardHeader>
        <CardContent>
          <StudentStatusActions studentId={student.userId} studentName={student.fullName} status={student.status} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function StudentPage({ params }: PageProps<"/students/[studentId]">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/students" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Alunos
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando aluno" />}>
        <StudentContent params={params} />
      </Suspense>
    </div>
  );
}
