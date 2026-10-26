import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Apple, ChevronRight, Plus, Utensils } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { listMealPlans } from "@/lib/nutrition/queries";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "@/lib/workouts/labels";

export const metadata: Metadata = { title: "Planos alimentares" };

const VIEWS: { key: PlanStatus; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "draft", label: "Rascunhos" },
  { key: "archived", label: "Arquivados" },
];

async function Content({ searchParams }: Pick<PageProps<"/nutrition">, "searchParams">) {
  const { status } = await searchParams;
  const view: PlanStatus = VIEWS.some((v) => v.key === status) ? (status as PlanStatus) : "active";
  const user = await requireStaff();
  const plans = await listMealPlans({ workspaceId: user.workspace.id });
  const visible = plans.filter((p) => p.status === view);

  return (
    <div className="grid gap-6">
      <nav aria-label="Filtrar planos" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-xl bg-muted p-1">
          {VIEWS.map(({ key, label }) => (
            <li key={key}>
              <Link
                href={{ pathname: "/nutrition", query: { status: key } }}
                aria-current={view === key ? "page" : undefined}
                className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
              >
                {label}
                <span className="rounded-full bg-background px-1.5 text-xs tabular-nums">{plans.filter((p) => p.status === key).length}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {visible.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="Nenhum plano nesta lista"
          description="Crie um plano alimentar para um aluno e publique quando estiver pronto."
          action={view !== "archived" ? <Link href="/nutrition/new" className={buttonVariants()}><Plus aria-hidden />Novo plano</Link> : undefined}
        />
      ) : (
        <ul className="grid gap-2">
          {visible.map((plan) => (
            <li key={plan.id}>
              <Link href={`/nutrition/${plan.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="truncate font-medium">{plan.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{plan.studentName}</p>
                </div>
                <StatusBadge tone={PLAN_STATUS_TONES[plan.status]}>{PLAN_STATUS_LABELS[plan.status]}</StatusBadge>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NutritionPage({ searchParams }: PageProps<"/nutrition">) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Planos alimentares"
        description="Monte refeições com quantidades e acompanhe as estimativas nutricionais."
        actions={
          <>
            <Link href="/foods" className={buttonVariants({ variant: "outline" })}><Apple aria-hidden />Alimentos</Link>
            <Link href="/nutrition/new" className={buttonVariants()}><Plus aria-hidden />Novo plano</Link>
          </>
        }
      />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando planos" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
