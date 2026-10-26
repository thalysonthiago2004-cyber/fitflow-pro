import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, CircleAlert, ClipboardList, HeartPulse, MessageCircle, Droplets, Dumbbell, Flame, MailPlus, Plus, UserPlus, Users } from "lucide-react";
import { IconTile } from "@/components/brand-ui/icon-tile";
import { MetricRow } from "@/components/brand-ui/metric-row";
import { ProgressRing } from "@/components/brand-ui/progress-ring";
import { EmptyState } from "@/components/empty-state";
import { QuickAdd } from "@/components/hydration/quick-add";
import { buttonVariants } from "@/components/ui/button";
import { WorkoutHeroCard } from "@/components/workouts/workout-hero-card";
import { type CurrentUser, requireUser } from "@/lib/auth/dal";
import { WORKSPACE_ROLE_LABELS, isStaffRole } from "@/lib/auth/roles";
import { formatDate, formatDuration, formatVolume, todayISO, weekdayToday } from "@/lib/format";
import { getCurrentGoal, getDailyTotals } from "@/lib/hydration/queries";
import { formatKcal } from "@/lib/nutrition/format";
import { getStudentMealPlans } from "@/lib/nutrition/queries";
import { weeklyStreak } from "@/lib/progress/calc";
import { getCompletedWorkoutDates, getWorkspaceWeekActivity } from "@/lib/progress/queries";
import { UserAvatar } from "@/components/user-avatar";
import { avatarUrl } from "@/lib/images/urls";
import { whatsappLink } from "@/lib/phone";
import { getLatestQuestionnaire } from "@/lib/students/questionnaire-queries";
import { buildAttention, getAttentionData } from "@/lib/students/attention-queries";
import { getTrainer, listPendingInvitations, listStudents } from "@/lib/students/queries";
import { getOpenLog, getStudentPlans, listLogs, listPlans } from "@/lib/workouts/queries";

export const metadata: Metadata = { title: "Painel" };

const numberFormat = new Intl.NumberFormat("pt-BR");

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

function Greeting({ name, subtitle, aside }: { name: string; subtitle: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Olá, {firstName(name)}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      </div>
      {aside}
    </div>
  );
}

function SectionTitle({ id, title, href, linkLabel }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="font-heading text-lg font-bold">{title}</h2>
      {href && (
        <Link href={href} className="rounded-full px-2 py-1 text-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-brand">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

// Trainer ----------------------------------------------------------------------

async function TrainerHome({ user }: { user: CurrentUser }) {
  const workspace = user.workspace!;
  const [students, invitations, plans, recentLogs, week, attentionData] = await Promise.all([
    listStudents(workspace.id),
    listPendingInvitations(workspace.id),
    listPlans({ workspaceId: workspace.id, statuses: ["active"] }),
    listLogs({ workspaceId: workspace.id, completedOnly: true, limit: 6 }),
    getWorkspaceWeekActivity(workspace.id),
    getAttentionData(workspace.id),
  ]);
  const active = students.filter((s) => s.status === "active").length;
  const attention = buildAttention(attentionData, students, plans);

  if (students.length === 0) {
    return (
      <div className="grid gap-8">
        <Greeting name={user.fullName} subtitle="Vamos montar seu espaço de trabalho." />
        <EmptyState
          icon={Users}
          title="Nenhum aluno ainda"
          description="Convide seu primeiro aluno. Ele recebe um link, cria a conta e já entra vinculado a você."
          action={
            <Link href="/students/invite" className={buttonVariants({ size: "lg" })}>
              <UserPlus aria-hidden />
              Convidar aluno
            </Link>
          }
        />
      </div>
    );
  }

  const share = active ? week.studentsTrained / active : 0;

  return (
    <div className="grid gap-8">
      <Greeting
        name={user.fullName}
        subtitle="Veja como seus alunos estão evoluindo."
        aside={
          <Link href="/students/invite" className={buttonVariants({ className: "hidden sm:inline-flex" })}>
            <UserPlus aria-hidden />
            Convidar aluno
          </Link>
        }
      />

      <section aria-labelledby="week-title" className="grid gap-6 rounded-3xl border bg-card bg-brand-glow p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-6">
        <h2 id="week-title" className="sr-only">Atividade da semana</h2>
        <ProgressRing
          value={share}
          center={`${Math.round(share * 100)}%`}
          caption="treinaram"
          label={`${week.studentsTrained} de ${active} alunos ativos treinaram nesta semana`}
          className="justify-self-center"
        />
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{week.studentsTrained} de {active}</span> alunos ativos registraram treino nesta semana.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricRow icon={Dumbbell} label="Treinos na semana" value={numberFormat.format(week.workouts)} />
            <MetricRow icon={Users} label="Alunos ativos" value={numberFormat.format(active)} />
            <MetricRow icon={ClipboardList} label="Planos de treino ativos" value={numberFormat.format(plans.length)} />
            <MetricRow icon={MailPlus} label="Convites pendentes" value={numberFormat.format(invitations.length)} />
          </div>
        </div>
      </section>

      {attention.length > 0 && (
        <section aria-labelledby="attention-title" className="grid gap-3">
          <h2 id="attention-title" className="flex items-center gap-2 font-heading text-lg font-bold">
            <CircleAlert className="size-5 text-warning" aria-hidden />
            Precisa de atenção
            <span className="rounded-full bg-muted px-2 text-sm tabular-nums">{attention.length}</span>
          </h2>
          <ul className="grid gap-2">
            {attention.slice(0, 8).map((item, i) => (
              <li key={`${item.studentId}-${i}`}>
                <Link href={item.href} className="flex items-center gap-3 rounded-2xl border bg-card p-3 pr-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-semibold">{item.studentName}</span>
                    <span className="truncate text-sm text-muted-foreground">{item.reason}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {attention.length > 8 && <p className="text-sm text-muted-foreground">E mais {attention.length - 8} itens. Veja a lista de alunos.</p>}
        </section>
      )}

      <section aria-labelledby="recent-title" className="grid gap-3">
        <SectionTitle id="recent-title" title="Treinos concluídos" href="/students" linkLabel="Ver alunos" />
        {recentLogs.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Quando seus alunos concluírem treinos, eles aparecem aqui.
          </p>
        ) : (
          <ul className="grid gap-2">
            {recentLogs.map((log) => (
              <li key={log.id}>
                <Link
                  href={`/students/${log.studentId}/logs/${log.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-3 pr-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold" aria-hidden>
                    {initials(log.studentName)}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-semibold">{log.studentName}</span>
                    <span className="truncate text-sm text-muted-foreground">{log.sessionName}</span>
                  </span>
                  <span className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatDate(log.completedAt!)}
                    <br />
                    {formatDuration(log.startedAt, log.completedAt!)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/workouts/new" className={buttonVariants({ variant: "secondary" })}><Plus aria-hidden />Novo plano de treino</Link>
        <Link href="/nutrition/new" className={buttonVariants({ variant: "secondary" })}><Plus aria-hidden />Novo plano alimentar</Link>
        <Link href="/students/invite" className={buttonVariants({ variant: "secondary", className: "sm:hidden" })}><UserPlus aria-hidden />Convidar aluno</Link>
      </div>

      <p className="text-xs text-muted-foreground">{workspace.name} · {WORKSPACE_ROLE_LABELS[workspace.role]}</p>
    </div>
  );
}

// Student ----------------------------------------------------------------------

async function StudentHome({ user }: { user: CurrentUser }) {
  if (!user.workspace) {
    return (
      <div className="grid gap-8">
        <Greeting name={user.fullName} subtitle="Falta pouco para começar." />
        <EmptyState icon={Users} title="Você ainda não tem um personal" description="Peça um link de convite ao seu personal para começar a acompanhar seus treinos." />
      </div>
    );
  }

  const [trainer, plans, openLog, waterGoal, waterToday, mealPlans, workoutDates, questionnaire] = await Promise.all([
    getTrainer(user.workspace.id),
    getStudentPlans(user.id),
    getOpenLog(user.id),
    getCurrentGoal(user.id),
    getDailyTotals(user.id, 1),
    getStudentMealPlans(user.id),
    getCompletedWorkoutDates(user.id),
    getLatestQuestionnaire(user.id),
  ]);

  const today = weekdayToday();
  const todayIso = todayISO();
  const sessions = plans.flatMap((plan) => plan.sessions).filter((s) => s.exercises.length > 0);
  // Sessions without fixed days can be done any day, so they count as available today.
  const todays = sessions.filter((s) => s.weekdays.length === 0 || s.weekdays.includes(today));
  const openSession = openLog ? sessions.find((s) => s.id === openLog.sessionId) : undefined;
  const streak = weeklyStreak(workoutDates, todayIso);
  const mondayOffset = (new Date(`${todayIso}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monday = new Date(`${todayIso}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);
  const weekCount = workoutDates.filter((d) => d >= monday.toISOString().slice(0, 10)).length;
  const water = waterToday[0].totalMl;
  const waterShare = waterGoal ? water / waterGoal : null;
  const planKcal = mealPlans[0]?.totals.kcal;

  return (
    <div className="grid gap-8">
      <Greeting
        name={user.fullName}
        subtitle={openLog ? "Seu treino está em andamento." : todays.length ? "Pronto para o treino de hoje?" : "Dia de descanso no seu plano."}
        aside={
          streak > 0 ? (
            <div role="img" className="flex shrink-0 items-center gap-2 rounded-2xl border bg-card px-3 py-2" aria-label={`${streak} ${streak === 1 ? "semana" : "semanas"} seguidas com treino`}>
              <Flame className="size-5 dark:text-brand" aria-hidden />
              <span className="grid leading-tight" aria-hidden>
                <span className="text-lg font-extrabold tabular-nums">{streak}</span>
                <span className="text-[11px] text-muted-foreground">{streak === 1 ? "semana" : "semanas"}</span>
              </span>
            </div>
          ) : undefined
        }
      />

      <section aria-label="Seu personal" className="flex items-center gap-4 rounded-3xl border bg-card p-4 sm:p-5">
        <UserAvatar name={trainer?.fullName ?? user.workspace.name} src={avatarUrl(trainer?.avatarPath ?? null)} className="size-14 text-base" />
        <div className="grid min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Seu personal</span>
          <span className="truncate font-heading text-lg font-bold">{trainer?.fullName ?? "Seu personal"}</span>
          <span className="truncate text-sm text-muted-foreground">{user.workspace.name}</span>
        </div>
        {trainer?.whatsapp && (
          <a
            href={whatsappLink(trainer.whatsapp, `Olá, ${trainer.fullName.split(/\s+/)[0]}! Aqui é ${user.fullName.split(/\s+/)[0]}, do FitFlow Pro.`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", className: "ml-auto shrink-0" })}
          >
            <MessageCircle aria-hidden />
            <span className="hidden sm:inline">Falar no WhatsApp</span>
            <span className="sr-only sm:hidden">Falar com {trainer.fullName} no WhatsApp (abre em nova aba)</span>
          </a>
        )}
      </section>

      {!questionnaire && (
        <Link href="/anamnese" className="flex items-center gap-4 rounded-3xl border border-warning/30 bg-warning/10 p-4 outline-none hover:bg-warning/15 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5">
          <HeartPulse className="size-6 shrink-0 text-warning" aria-hidden />
          <span className="grid min-w-0 flex-1">
            <span className="font-semibold">Responda a anamnese</span>
            <span className="text-sm text-muted-foreground">7 perguntas rápidas de saúde para seu personal montar treinos seguros.</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <section aria-labelledby="plan-title" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="plan-title" className="font-heading text-lg font-bold">Plano de treino</h2>
          <Link href="/training" className="text-sm font-semibold hover:underline dark:text-brand">Ver todos</Link>
        </div>
        {openLog && openSession ? (
          <WorkoutHeroCard session={openSession} eyebrow="Em andamento" href={`/training/log/${openLog.id}`} cta="Continuar treino" inProgress />
        ) : todays.length > 0 ? (
          todays.map((session) => (
            <WorkoutHeroCard
              key={session.id}
              session={session}
              eyebrow={session.weekdays.length === 0 ? "Disponível hoje" : "Treino de hoje"}
              href={`/training/sessions/${session.id}`}
              cta="Iniciar"
            />
          ))
        ) : sessions.length > 0 ? (
          <div className="flex items-center gap-4 rounded-3xl border bg-card p-5">
            <IconTile icon={Dumbbell} />
            <p className="flex-1 text-sm text-muted-foreground">Nenhum treino programado para hoje. Descanse ou confira os próximos.</p>
            <Link href="/training" className={buttonVariants({ variant: "secondary" })}>Ver treinos</Link>
          </div>
        ) : (
          <EmptyState icon={Dumbbell} title="Seu plano ainda não foi publicado" description="Assim que seu personal publicar o plano de treino, ele aparece aqui." />
        )}
      </section>

      <section aria-labelledby="today-title" className="grid gap-5 rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="today-title" className="font-heading text-lg font-bold">Progresso de hoje</h2>
          <Link href="/hydration" className="text-sm font-semibold hover:underline dark:text-brand">Hidratação</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <ProgressRing
            value={waterShare}
            center={waterShare === null ? "—" : `${Math.round(waterShare * 100)}%`}
            caption={waterShare === null ? "sem meta" : "da meta de água"}
            label={waterGoal ? `Água hoje: ${formatVolume(water)} de ${formatVolume(waterGoal)}` : "Sem meta de água definida"}
            className="justify-self-center"
          />
          <div className="grid gap-4">
            <MetricRow icon={Droplets} label="Água" value={formatVolume(water)} detail={waterGoal ? `/ ${formatVolume(waterGoal)}` : undefined} />
            <MetricRow icon={Dumbbell} label="Treinos nesta semana" value={numberFormat.format(weekCount)} />
            {planKcal !== undefined && planKcal > 0 && (
              <MetricRow icon={Flame} label="Plano alimentar" value={`≈ ${formatKcal(planKcal)}`} detail="/ dia" />
            )}
          </div>
        </div>
        <QuickAdd />
      </section>
    </div>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  return isStaffRole(user.workspace?.role) ? <TrainerHome user={user} /> : <StudentHome user={user} />;
}

function DashboardSkeleton() {
  return (
    <div role="status" className="grid gap-8" aria-busy="true" aria-label="Carregando painel">
      <div className="h-12 w-56 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      <div className="h-48 animate-pulse rounded-3xl bg-muted" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
