import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarPlus, ChevronRight, Plus, TrendingUp, FileText } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionnaireSummary } from "@/components/students/questionnaire-summary";
import { requireStaff } from "@/lib/auth/dal";
import { getLatestQuestionnaire } from "@/lib/students/questionnaire-queries";
import { addDays, ageFromBirthDate, formatDate, formatDuration, formatNumber, todayISO } from "@/lib/format";
import { getCompletedWorkoutDates } from "@/lib/progress/queries";
import { type Appointment, listAppointments } from "@/lib/schedule/queries";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/lib/schedule/schemas";
import { localTime } from "@/lib/schedule/time";
import { daysAgo } from "@/lib/students/roster";
import { cn } from "@/lib/utils";
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

const SECTIONS = [
  ["resumo", "Resumo"],
  ["saude", "Saúde"],
  ["treinos", "Treinos"],
  ["agenda", "Agenda"],
  ["nutricao", "Nutrição e água"],
  ["cadastro", "Cadastro"],
] as const;

const dayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const sessionDay = (iso: string) => dayFormat.format(new Date(iso)).replace(".", "");

function Stat({ label, value, detail, warn = false }: { label: string; value: string; detail?: string; warn?: boolean }) {
  return (
    <div className="grid content-start gap-1 surface p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("truncate font-heading text-lg font-bold first-letter:uppercase", warn && "text-warning")}>{value}</dd>
      {detail && <dd className="truncate text-xs text-muted-foreground tabular-nums">{detail}</dd>}
    </div>
  );
}

function SessionList({ title, sessions }: { title: string; sessions: Appointment[] }) {
  return (
    <div className="grid gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="grid gap-2">
        {sessions.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm">
            <span className="font-medium first-letter:uppercase">{sessionDay(a.startsAt)}</span>
            <span className="tabular-nums text-muted-foreground">
              {localTime(a.startsAt)}–{localTime(a.endsAt)}
              {a.location && ` · ${a.location}`}
            </span>
            <span className="ml-auto">
              <StatusBadge tone={APPOINTMENT_STATUS_TONES[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</StatusBadge>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="max-w-64 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

async function StudentContent({ params }: Pick<PageProps<"/students/[studentId]">, "params">) {
  const { studentId } = await params;
  if (!UUID.test(studentId)) notFound();
  const user = await requireStaff();
  const student = await getStudent(user.workspace.id, studentId);
  if (!student) notFound();
  const today = todayISO();
  const [plans, logs, goalMl, waterDays, mealPlans, questionnaire, workoutDates, sessions] = await Promise.all([
    listPlans({ workspaceId: user.workspace.id, studentId }),
    listLogs({ workspaceId: user.workspace.id, studentId, limit: 10 }),
    getCurrentGoal(studentId),
    getDailyTotals(studentId, 7),
    listMealPlans({ workspaceId: user.workspace.id, studentId }),
    getLatestQuestionnaire(studentId),
    getCompletedWorkoutDates(studentId),
    listAppointments(user.workspace.id, addDays(today, -90), addDays(today, 60)),
  ]);
  const now = new Date();
  const mine = sessions.filter((a) => a.studentId === studentId);
  const upcoming = mine.filter((a) => a.status === "scheduled" && new Date(a.endsAt) > now).slice(0, 3);
  const past = mine.filter((a) => new Date(a.endsAt) <= now || a.status !== "scheduled").reverse().slice(0, 5);
  const activePlan = plans.filter((p) => p.status === "active").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const lastWorkout = workoutDates.reduce<string | null>((last, d) => (last === null || d > last ? d : last), null);
  const workouts30 = workoutDates.filter((d) => d >= addDays(today, -29)).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        title={student.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={student.status === "active" ? "success" : "neutral"}>{STUDENT_STATUS_LABELS[student.status]}</StatusBadge>
            {student.email} · aluno desde {formatDate(student.joinedAt)}
          </span>
        }
        actions={
          <>
            {student.status === "active" && (
              <Link href={`/schedule?aluno=${student.userId}`} className={buttonVariants({ size: "sm" })}>
                <CalendarPlus aria-hidden />
                Agendar sessão
              </Link>
            )}
            <Link href={`/students/${student.userId}/progress`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <TrendingUp aria-hidden />
              Evolução e avaliação
            </Link>
            <Link href={`/students/${student.userId}/report`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <FileText aria-hidden />
              Relatório PDF
            </Link>
          </>
        }
      />

      <section id="resumo" aria-label="Resumo" className="grid scroll-mt-32 gap-3">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Treinos (30 dias)" value={String(workouts30)} />
          <Stat label="Último treino" value={lastWorkout ? daysAgo(lastWorkout, today)! : "Nunca treinou"} detail={lastWorkout ? formatDate(lastWorkout) : undefined} />
          <Stat label="Próxima sessão" value={upcoming[0] ? sessionDay(upcoming[0].startsAt) : "Nenhuma"} detail={upcoming[0] ? `${localTime(upcoming[0].startsAt)}–${localTime(upcoming[0].endsAt)}` : undefined} />
          <Stat
            label="Plano ativo"
            value={activePlan ? activePlan.name : "Nenhum"}
            detail={activePlan?.endsOn ? `até ${formatDate(activePlan.endsOn)}` : activePlan ? undefined : "Publique um plano"}
            warn={!activePlan}
          />
        </dl>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 surface px-4 py-3">
          <Fact label="Nível" value={student.experienceLevel ? EXPERIENCE_LEVEL_LABELS[student.experienceLevel] : "Não informado"} />
          <Fact label="Idade" value={student.birthDate ? `${ageFromBirthDate(student.birthDate)} anos` : "Não informada"} />
          <Fact label="Altura" value={student.heightCm !== null ? `${formatNumber(student.heightCm)} cm` : "Não informada"} />
          <Fact label="Objetivo" value={student.goal ?? "Não definido"} />
        </dl>
      </section>

      <nav aria-label="Seções do aluno" className="sticky top-16 z-20 -mx-4 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 py-2">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Card id="saude" className="scroll-mt-32 gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Anamnese (PAR-Q)</h2></CardTitle>
        </CardHeader>
        <CardContent>
          {questionnaire ? (
            <QuestionnaireSummary questionnaire={questionnaire} />
          ) : (
            <p className="text-sm text-muted-foreground">O aluno ainda não respondeu. Ele vê um lembrete no painel dele para preencher.</p>
          )}
        </CardContent>
      </Card>

      <Card id="treinos" className="scroll-mt-32 gap-4 py-6 [--card-spacing:--spacing(6)]">
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

      <Card id="agenda" className="scroll-mt-32 gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <h2>Sessões na agenda</h2>
          </CardTitle>
          <CardDescription>Próximas e dos últimos 90 dias.</CardDescription>
          {student.status === "active" && (
            <CardAction>
              <Link href={`/schedule?aluno=${student.userId}`} aria-label="Agendar sessão com o aluno" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Plus aria-hidden />
                Agendar
              </Link>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          {upcoming.length === 0 && past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sessão marcada com este aluno.</p>
          ) : (
            <>
              {upcoming.length > 0 && <SessionList title="Próximas" sessions={upcoming} />}
              {past.length > 0 && <SessionList title="Histórico" sessions={past} />}
            </>
          )}
        </CardContent>
      </Card>

      <Card id="nutricao" className="scroll-mt-32 gap-4 py-6 [--card-spacing:--spacing(6)]">
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

      <Card id="cadastro" className="scroll-mt-32 gap-6 py-6 [--card-spacing:--spacing(6)]">
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
    <div className="grid max-w-4xl gap-6">
      <BackLink href="/students">Alunos</BackLink>
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Carregando aluno" />}>
        <StudentContent params={params} />
      </Suspense>
    </div>
  );
}
