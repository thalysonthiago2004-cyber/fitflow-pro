import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, ClipboardList, Dumbbell, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { normalize } from "@/lib/text";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "@/lib/workouts/labels";
import { listPlans } from "@/lib/workouts/queries";
import { STARTER_TEMPLATES } from "@/lib/workouts/starter-templates";
import { StarterTemplatesButton } from "./starter-templates-button";

export const metadata: Metadata = { title: "Planos de treino" };

type View = PlanStatus | "templates";
type Sort = "updated" | "name" | "student";
const SORTS: { key: Sort; label: string }[] = [
  { key: "updated", label: "Mais recentes" },
  { key: "name", label: "Nome do plano" },
  { key: "student", label: "Aluno" },
];
const VIEWS: { key: View; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "draft", label: "Rascunhos" },
  { key: "archived", label: "Arquivados" },
  { key: "templates", label: "Modelos" },
];

async function PlansContent({ searchParams }: Pick<PageProps<"/workouts">, "searchParams">) {
  const { status, q, ordem } = await searchParams;
  const view: View = VIEWS.some((v) => v.key === status) ? (status as View) : "active";
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const sort: Sort = SORTS.some((s) => s.key === ordem) ? (ordem as Sort) : "updated";
  const user = await requireStaff();
  const [plans, templates] = await Promise.all([listPlans({ workspaceId: user.workspace.id }), listPlans({ workspaceId: user.workspace.id, templates: true })]);
  const needle = normalize(query);
  const inView = view === "templates" ? templates : plans.filter((p) => p.status === view);
  const visible = inView
    .filter((p) => !needle || normalize(p.name).includes(needle) || normalize(p.studentName).includes(needle))
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name, "pt-BR") : sort === "student" ? a.studentName.localeCompare(b.studentName, "pt-BR") || a.name.localeCompare(b.name, "pt-BR") : b.updatedAt.localeCompare(a.updatedAt),
    );
  const link = (extra: Record<string, string>) => ({
    pathname: "/workouts",
    query: { status: view, ...(query ? { q: query } : {}), ...(sort !== "updated" ? { ordem: sort } : {}), ...extra },
  });
  const count = (key: View) => (key === "templates" ? templates.length : plans.filter((p) => p.status === key).length);

  return (
    <div className="grid gap-6">
      <nav aria-label="Filtrar planos" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-xl bg-muted p-1">
          {VIEWS.map(({ key, label }) => (
            <li key={key}>
              <Link
                href={{ pathname: "/workouts", query: { status: key, ...(query ? { q: query } : {}) } }}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form role="search" action="/workouts" className="relative w-full max-w-md">
          <input type="hidden" name="status" value={view} />
          {sort !== "updated" && <input type="hidden" name="ordem" value={sort} />}
          <label htmlFor="plan-search" className="sr-only">
            Buscar plano ou aluno
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="plan-search" name="q" type="search" defaultValue={query} placeholder="Buscar plano ou aluno" className="pl-9" />
        </form>
        <nav aria-label="Ordenar planos" className="flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-1 text-muted-foreground">Ordenar:</span>
          {SORTS.filter((s) => view !== "templates" || s.key !== "student").map(({ key, label }) => (
            <Link
              key={key}
              href={link({ ordem: key })}
              aria-current={sort === key ? "page" : undefined}
              className="inline-flex h-9 items-center rounded-full px-3 font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {visible.length === 0 && query ? (
        <EmptyState icon={Search} title="Nenhum plano encontrado" description="Tente buscar por outro nome de plano ou de aluno." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={view === "active" ? "Nenhum plano ativo" : view === "draft" ? "Nenhum rascunho" : view === "templates" ? "Nenhum modelo ainda" : "Nenhum plano arquivado"}
          description={
            view === "templates"
              ? "Comece pelos modelos prontos (iniciante, ABC e condicionamento) ou salve um plano seu com \"Duplicar → Salvar como modelo\"."
              : view === "active"
                ? "Crie um plano e publique para o aluno começar a treinar."
                : "Os planos aparecem aqui conforme o status."
          }
          action={
            view === "templates" ? (
              <StarterTemplatesButton />
            ) : view === "active" || view === "draft" ? (
              <Link href="/workouts/new" className={buttonVariants()}><Plus aria-hidden />Novo plano</Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-2">
          {view === "templates" && !STARTER_TEMPLATES.every((t) => templates.some((p) => p.name === t.name)) && (
            <li className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">Quer um ponto de partida? Adicione os modelos prontos e ajuste ao seu estilo.</p>
              <StarterTemplatesButton variant="outline" />
            </li>
          )}
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
                  <p className="text-xs text-muted-foreground">Atualizado em {formatDate(plan.updatedAt)}</p>
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
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando planos" />}>
        <PlansContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
