import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, ClipboardList, Dumbbell, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "@/lib/workouts/labels";
import { listPlans } from "@/lib/workouts/queries";

export const metadata: Metadata = { title: "Planos de treino" };

type View = PlanStatus | "templates";
const VIEWS: { key: View; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "draft", label: "Rascunhos" },
  { key: "archived", label: "Arquivados" },
  { key: "templates", label: "Modelos" },
];

async function PlansContent({ searchParams }: Pick<PageProps<"/workouts">, "searchParams">) {
  const { status } = await searchParams;
  const view: View = VIEWS.some((v) => v.key === status) ? (status as View) : "active";
  const user = await requireStaff();
  const [plans, templates] = await Promise.all([listPlans({ workspaceId: user.workspace.id }), listPlans({ workspaceId: user.workspace.id, templates: true })]);
  const visible = view === "templates" ? templates : plans.filter((p) => p.status === view);
  const count = (key: View) => (key === "templates" ? templates.length : plans.filter((p) => p.status === key).length);

  return (
    <div className="grid gap-6">
      <nav aria-label="Filtrar planos" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-xl bg-muted p-1">
          {VIEWS.map(({ key, label }) => (
            <li key={key}>
              <Link
                href={{ pathname: "/workouts", query: { status: key } }}
                aria-current={view === key ? "page" : undefined}
                className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
              >
                {label}
                <span className="rounded-full bg-background px-1.5 text-xs tabular-nums">{count(key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={view === "active" ? "Nenhum plano ativo" : view === "draft" ? "Nenhum rascunho" : view === "templates" ? "Nenhum modelo ainda" : "Nenhum plano arquivado"}
          description={
            view === "templates"
              ? "Abra um plano pronto e use \"Duplicar → Salvar como modelo\". Depois é só criar planos de alunos a partir dele."
              : view === "active"
                ? "Crie um plano e publique para o aluno começar a treinar."
                : "Os planos aparecem aqui conforme o status."
          }
          action={view === "active" || view === "draft" ? <Link href="/workouts/new" className={buttonVariants()}><Plus aria-hidden />Novo plano</Link> : undefined}
        />
      ) : (
        <ul className="grid gap-2">
          {visible.map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/workouts/${plan.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="truncate font-medium">{plan.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {plan.studentName}
                    {plan.startsOn && ` · desde ${formatDate(plan.startsOn)}`}
                    {plan.endsOn && ` · até ${formatDate(plan.endsOn)}`}
                  </p>
                </div>
                {plan.isTemplate ? <StatusBadge tone="info">Modelo</StatusBadge> : <StatusBadge tone={PLAN_STATUS_TONES[plan.status]}>{PLAN_STATUS_LABELS[plan.status]}</StatusBadge>}
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WorkoutsPage({ searchParams }: PageProps<"/workouts">) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Planos de treino"
        description="Monte, publique e acompanhe os planos dos seus alunos."
        actions={
          <>
            <Link href="/exercises" className={buttonVariants({ variant: "outline" })}><Dumbbell aria-hidden />Exercícios</Link>
            <Link href="/workouts/new" className={buttonVariants()}><Plus aria-hidden />Novo plano</Link>
          </>
        }
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando planos" />}>
        <PlansContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
