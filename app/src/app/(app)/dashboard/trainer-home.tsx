import Link from "next/link";
import { CalendarDays, ChartNoAxesCombined, ChevronRight, CircleAlert, Dumbbell, MapPin, Plus, Target, UserPlus, Users } from "lucide-react";
import { KpiCard } from "@/components/brand-ui/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { type OnboardingStep, OnboardingChecklist } from "@/components/onboarding-checklist";
import { PageHeader } from "@/components/page-header";
import { WeeklyWorkoutsChart } from "@/components/progress/weekly-workouts-chart";
import { buttonVariants } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth/dal";
import { WORKSPACE_ROLE_LABELS } from "@/lib/auth/roles";
import { PERIODS, type Period, adherence, joinedIn, percentChange, periodRanges, summarize } from "@/lib/dashboard/metrics";
import { addDays, formatDate, formatDuration, todayISO } from "@/lib/format";
import { weeklyCounts } from "@/lib/progress/calc";
import { getWorkspaceCompletions } from "@/lib/progress/queries";
import { listAppointments } from "@/lib/schedule/queries";
import { localDate, localTime } from "@/lib/schedule/time";
import { buildAttention, getAttentionData } from "@/lib/students/attention-queries";
import { listPendingInvitations, listStudents } from "@/lib/students/queries";
import { createClient } from "@/lib/supabase/server";
import { listLogs, listPlans } from "@/lib/workouts/queries";
import { cn } from "@/lib/utils";

// Trainer home: how the business is doing (period KPIs), what needs attention
// today (agenda, follow-ups) and the next useful action.

const numberFormat = new Intl.NumberFormat("pt-BR");
const longToday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
const CHART_WEEKS = 12;

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

function SectionTitle({ id, title, count, href, linkLabel, icon: Icon }: { id: string; title: string; count?: number; href?: string; linkLabel?: string; icon?: typeof Users }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 font-heading text-lg font-bold">
        {Icon && <Icon className="size-5 text-warning" aria-hidden />}
        {title}
        {count !== undefined && <span className="rounded-full bg-muted px-2 text-sm tabular-nums">{count}</span>}
      </h2>
      {href && (
        <Link href={href} className="rounded-full px-2 py-1 text-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-brand">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function PeriodSwitch({ period }: { period: Period }) {
  return (
    <nav aria-label="Período das métricas" className="inline-flex rounded-full border bg-card p-1">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={p === 30 ? "/dashboard" : `/dashboard?periodo=${p}`}
          aria-current={p === period ? "page" : undefined}
          className="inline-flex h-9 min-w-14 items-center justify-center rounded-full px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-primary aria-[current=page]:font-semibold aria-[current=page]:text-primary-foreground"
        >
          {p} dias
        </Link>
      ))}
    </nav>
  );
}

export async function TrainerHome({ user, period }: { user: CurrentUser; period: Period }) {
  const workspace = user.workspace!;
  const today = todayISO();
  const ranges = periodRanges(today, period);
  const since = [ranges.previous.from, addDays(today, -7 * CHART_WEEKS)].sort()[0];
  const supabase = await createClient();
  const [students, invitations, plans, recentLogs, completions, attentionData, templates, devices, agenda] = await Promise.all([
    listStudents(workspace.id),
    listPendingInvitations(workspace.id),
    listPlans({ workspaceId: workspace.id, statuses: ["active"] }),
    listLogs({ workspaceId: workspace.id, completedOnly: true, limit: 6 }),
    getWorkspaceCompletions(workspace.id, since),
    getAttentionData(workspace.id),
    listPlans({ workspaceId: workspace.id, templates: true }),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    listAppointments(workspace.id, today, addDays(today, 6)),
  ]);

  const onboarding: OnboardingStep[] = [
    { done: user.avatarPath !== null, label: "Adicione sua foto", hint: "Seus alunos veem quem é o personal deles.", href: "/settings" },
    { done: user.whatsapp !== null, label: "Cadastre seu WhatsApp", hint: "Os alunos falam com você em um toque.", href: "/settings" },
    { done: templates.length > 0, label: "Monte ou adicione modelos de treino", hint: "Comece pelos modelos prontos e adapte.", href: "/workouts?status=templates" },
    { done: students.length > 0 || invitations.length > 0, label: "Convide seu primeiro aluno", hint: "Ele recebe um link e entra já vinculado a você.", href: "/students/invite" },
    { done: plans.length > 0, label: "Publique um plano de treino", hint: "Crie a partir de um modelo e publique para o aluno.", href: "/workouts" },
    { done: (devices.count ?? 0) > 0, label: "Ative as notificações", hint: "Saiba quando um aluno concluir um treino.", href: "/settings" },
  ];

  const date = longToday.format(new Date());
  const header = (summary: string) => (
    <PageHeader
      eyebrow={date}
      title={`Olá, ${firstName(user.fullName)}`}
      description={summary}
      actions={
        <Link href="/students/invite" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
          <UserPlus aria-hidden />
          Convidar aluno
        </Link>
      }
    />
  );

  if (students.length === 0) {
    return (
      <div className="grid max-w-3xl gap-8">
        {header("Vamos montar seu espaço de trabalho.")}
        <OnboardingChecklist steps={onboarding} />
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

  const active = students.filter((s) => s.status === "active");
  const attention = buildAttention(attentionData, students, plans);
  const current = summarize(completions, ranges.current);
  const previous = summarize(completions, ranges.previous);
  const share = adherence(current.studentsTrained, active.length);
  const previousShare = adherence(previous.studentsTrained, active.length);
  const joinedDates = students.map((s) => localDate(s.joinedAt));
  const newStudents = joinedIn(joinedDates, ranges.current);
  const against = `vs. ${period} dias anteriores`;
  const booked = agenda.filter((a) => a.status === "scheduled");
  const todays = agenda.filter((a) => localDate(a.startsAt) === today && a.status !== "cancelled");
  const chart = weeklyCounts(
    completions.map((c) => c.date),
    today,
    CHART_WEEKS,
  );

  const summary = [
    todays.length ? `${todays.length} ${todays.length === 1 ? "sessão" : "sessões"} hoje` : "Nenhuma sessão hoje",
    attention.length ? `${attention.length} ${attention.length === 1 ? "aluno precisa" : "itens precisam"} de atenção` : "nada pendente com os alunos",
  ].join(" · ");

  return (
    <div className="grid gap-8">
      {header(`${summary}.`)}

      <OnboardingChecklist steps={onboarding} />

      <section aria-labelledby="kpi-title" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="kpi-title" className="font-heading text-lg font-bold">
            Últimos {period} dias
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSwitch period={period} />
            <Link href={`/reports?periodo=${period}`} className={buttonVariants({ variant: "ghost" })}>
              <ChartNoAxesCombined aria-hidden />
              Relatórios
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={Users} label="Alunos ativos" value={numberFormat.format(active.length)} detail={newStudents ? `+${newStudents} ${newStudents === 1 ? "novo" : "novos"} no período` : "Nenhum novo no período"} />
          <KpiCard
            icon={Dumbbell}
            label="Treinos concluídos"
            value={numberFormat.format(current.workouts)}
            trend={{ value: percentChange(current.workouts, previous.workouts), unit: "%", against }}
            highlight
          />
          <KpiCard
            icon={Target}
            label="Adesão"
            value={share === null ? "—" : `${Math.round(share * 100)}%`}
            detail={`${current.studentsTrained} de ${active.length} alunos ativos treinaram`}
            trend={{ value: share === null || previousShare === null || previous.workouts === 0 ? null : Math.round((share - previousShare) * 100), unit: "p.p.", against }}
          />
          <KpiCard icon={CalendarDays} label="Sessões agendadas" value={numberFormat.format(booked.length)} detail="nos próximos 7 dias" />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* First in reading order: on phones, today's agenda and follow-ups come before the history. */}
        <div className="grid content-start gap-8 lg:col-start-2 lg:row-start-1">
          <section aria-labelledby="today-agenda-title" className="grid gap-3 surface p-5">
            <SectionTitle id="today-agenda-title" title="Agenda de hoje" href="/schedule" linkLabel="Abrir agenda" />
            {todays.length === 0 ? (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">Nenhuma sessão marcada para hoje.</p>
                <Link href="/schedule" className={buttonVariants({ variant: "secondary", className: "w-fit" })}>
                  <Plus aria-hidden />
                  Agendar sessão
                </Link>
              </div>
            ) : (
              <ol className="grid gap-2">
                {todays.map((a) => (
                  <li key={a.id} className={cn("flex items-start gap-3 rounded-xl border p-3", a.status !== "scheduled" && "opacity-70")}>
                    <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{localTime(a.startsAt)}</span>
                    <span className="grid min-w-0">
                      <span className="truncate font-semibold">{a.studentName}</span>
                      <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {a.status === "completed" ? "Realizada" : a.status === "no_show" ? "Falta" : `até ${localTime(a.endsAt)}`}
                        {a.location && (
                          <>
                            {" · "}
                            <MapPin className="size-3 shrink-0" aria-hidden />
                            {a.location}
                          </>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="attention-title" className="grid gap-3">
            <SectionTitle id="attention-title" title="Precisa de atenção" count={attention.length} icon={attention.length ? CircleAlert : undefined} />
            {attention.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Tudo em dia: nenhum aluno parado, plano vencendo ou anamnese pendente.</p>
            ) : (
              <ul className="grid gap-2">
                {attention.slice(0, 6).map((item, i) => (
                  <li key={`${item.studentId}-${i}`}>
                    <Link href={item.href} className="flex items-center gap-3 surface-row p-3 pr-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate font-semibold">{item.studentName}</span>
                        <span className="text-sm text-muted-foreground">{item.reason}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {attention.length > 6 && <p className="text-sm text-muted-foreground">E mais {attention.length - 6} itens. Veja a lista de alunos.</p>}
          </section>

          <section aria-labelledby="actions-title" className="grid gap-3">
            <h2 id="actions-title" className="font-heading text-lg font-bold">Atalhos</h2>
            <div className="grid gap-2">
              <Link href="/workouts/new" className={buttonVariants({ variant: "secondary", className: "justify-start" })}><Plus aria-hidden />Novo plano de treino</Link>
              <Link href="/nutrition/new" className={buttonVariants({ variant: "secondary", className: "justify-start" })}><Plus aria-hidden />Novo plano alimentar</Link>
              <Link href="/schedule" className={buttonVariants({ variant: "secondary", className: "justify-start" })}><CalendarDays aria-hidden />Agendar sessão</Link>
            </div>
          </section>
        </div>
        <div className="grid content-start gap-8 lg:col-start-1 lg:row-start-1">
          <section aria-label="Gráfico de treinos" className="surface p-5">
            <WeeklyWorkoutsChart weeks={chart} />
          </section>

          <section aria-labelledby="recent-title" className="grid gap-3">
            <SectionTitle id="recent-title" title="Treinos concluídos" href="/students" linkLabel="Ver alunos" />
            {recentLogs.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Quando seus alunos concluírem treinos, eles aparecem aqui.</p>
            ) : (
              <ul className="grid gap-2">
                {recentLogs.map((log) => (
                  <li key={log.id}>
                    <Link
                      href={`/students/${log.studentId}/logs/${log.id}`}
                      className="flex items-center gap-3 surface-row p-3 pr-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
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
        </div>

      </div>

      <p className="text-xs text-muted-foreground">
        {workspace.name} · {WORKSPACE_ROLE_LABELS[workspace.role]} · Métricas a partir dos treinos registrados no app; a adesão usa os alunos ativos hoje.
      </p>
    </div>
  );
}
