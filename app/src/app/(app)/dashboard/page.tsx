import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, CircleAlert, ClipboardList, Dumbbell, MailPlus, Plus, UserPlus, Users } from "lucide-react";
import { MetricRow } from "@/components/brand-ui/metric-row";
import { ProgressRing } from "@/components/brand-ui/progress-ring";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { type CurrentUser, requireUser } from "@/lib/auth/dal";
import { WORKSPACE_ROLE_LABELS, isStaffRole } from "@/lib/auth/roles";
import { formatDate, formatDuration } from "@/lib/format";
import { getWorkspaceWeekActivity } from "@/lib/progress/queries";
import { type OnboardingStep, OnboardingChecklist } from "@/components/onboarding-checklist";
import { createClient } from "@/lib/supabase/server";
import { buildAttention, getAttentionData } from "@/lib/students/attention-queries";
import { listPendingInvitations, listStudents } from "@/lib/students/queries";
import { listLogs, listPlans } from "@/lib/workouts/queries";
import { StudentHome } from "./student-home";

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
  const supabase = await createClient();
  const [students, invitations, plans, recentLogs, week, attentionData, templates, devices] = await Promise.all([
    listStudents(workspace.id),
    listPendingInvitations(workspace.id),
    listPlans({ workspaceId: workspace.id, statuses: ["active"] }),
    listLogs({ workspaceId: workspace.id, completedOnly: true, limit: 6 }),
    getWorkspaceWeekActivity(workspace.id),
    getAttentionData(workspace.id),
    listPlans({ workspaceId: workspace.id, templates: true }),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const onboarding: OnboardingStep[] = [
    { done: user.avatarPath !== null, label: "Adicione sua foto", hint: "Seus alunos veem quem é o personal deles.", href: "/settings" },
    { done: user.whatsapp !== null, label: "Cadastre seu WhatsApp", hint: "Os alunos falam com você em um toque.", href: "/settings" },
    { done: templates.length > 0, label: "Monte ou adicione modelos de treino", hint: "Comece pelos modelos prontos e adapte.", href: "/workouts?status=templates" },
    { done: students.length > 0 || invitations.length > 0, label: "Convide seu primeiro aluno", hint: "Ele recebe um link e entra já vinculado a você.", href: "/students/invite" },
    { done: plans.length > 0, label: "Publique um plano de treino", hint: "Crie a partir de um modelo e publique para o aluno.", href: "/workouts" },
    { done: (devices.count ?? 0) > 0, label: "Ative as notificações", hint: "Saiba quando um aluno concluir um treino.", href: "/settings" },
  ];
  const active = students.filter((s) => s.status === "active").length;
  const attention = buildAttention(attentionData, students, plans);

  if (students.length === 0) {
    return (
      <div className="grid gap-8">
        <Greeting name={user.fullName} subtitle="Vamos montar seu espaço de trabalho." />
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

      <OnboardingChecklist steps={onboarding} />

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
