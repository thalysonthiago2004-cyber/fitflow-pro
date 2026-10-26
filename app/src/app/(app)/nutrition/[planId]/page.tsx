import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { NutrientSummary, NutritionDisclaimer } from "@/components/nutrition/nutrient-summary";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/dal";
import { getMealPlan, listFoods } from "@/lib/nutrition/queries";
import { listStudents } from "@/lib/students/queries";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "@/lib/workouts/labels";
import { AddMealForm } from "./add-meal-form";
import { DuplicateMealPlanForm } from "./duplicate-meal-plan-form";
import { MealCard } from "./meal-card";
import { MealPlanDetailsForm, MealPlanStatusActions } from "./meal-plan-forms";

export const metadata: Metadata = { title: "Plano alimentar" };

async function Builder({ params }: Pick<PageProps<"/nutrition/[planId]">, "params">) {
  const { planId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(planId)) notFound();
  const user = await requireStaff();
  const [plan, foods, students] = await Promise.all([getMealPlan(planId), listFoods(user.workspace.id), listStudents(user.workspace.id)]);
  if (!plan || plan.workspaceId !== user.workspace.id) notFound();
  const pickable = foods.map(({ id, name, basis, unitLabel, unitAmount }) => ({ id, name, basis, unitLabel, unitAmount }));

  return (
    <div className="grid gap-8">
      <PageHeader
        title={plan.name}
        description={<>Aluno: <Link href={`/students/${plan.studentId}`} className="font-medium text-foreground underline underline-offset-4 hover:no-underline">{plan.studentName}</Link></>}
        actions={<StatusBadge tone={PLAN_STATUS_TONES[plan.status]}>{PLAN_STATUS_LABELS[plan.status]}</StatusBadge>}
      />

      {plan.status === "draft" && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">Rascunho: o aluno ainda não vê este plano.</p>
      )}

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardContent className="grid gap-4">
          <NutrientSummary totals={plan.totals} label="Total diário estimado" />
          <NutritionDisclaimer sources={plan.sources} />
        </CardContent>
      </Card>

      {foods.length === 0 && (
        <p className="rounded-lg border p-4 text-sm">
          Você ainda não cadastrou alimentos.{" "}
          <Link href="/foods/new" className="font-medium underline underline-offset-4">Cadastre o primeiro</Link> para montar as refeições.
        </p>
      )}

      <section aria-labelledby="meals-title" className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="meals-title" className="font-heading text-xl font-semibold">Refeições</h2>
          <Link href="/foods" className={buttonVariants({ variant: "ghost", size: "sm" })}>Gerenciar alimentos</Link>
        </div>
        {plan.meals.map((meal, i) => (
          <MealCard key={meal.id} meal={meal} index={i} total={plan.meals.length} foods={pickable} />
        ))}
        <AddMealForm planId={plan.id} />
      </section>

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Detalhes do plano</h2></CardTitle>
        </CardHeader>
        <CardContent><MealPlanDetailsForm planId={plan.id} name={plan.name} notes={plan.notes} /></CardContent>
      </Card>

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Duplicar</h2></CardTitle>
          <CardDescription>A cópia leva refeições, horários e alimentos, e começa como rascunho.</CardDescription>
        </CardHeader>
        <CardContent>
          <DuplicateMealPlanForm planId={plan.id} planName={plan.name} students={students.filter((s) => s.status === "active").map((s) => ({ id: s.userId, name: s.fullName }))} />
        </CardContent>
      </Card>

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Publicação</h2></CardTitle>
          <CardDescription>Controle o que o aluno vê.</CardDescription>
        </CardHeader>
        <CardContent><MealPlanStatusActions planId={plan.id} status={plan.status} studentName={plan.studentName} /></CardContent>
      </Card>
    </div>
  );
}

export default function MealPlanPage({ params }: PageProps<"/nutrition/[planId]">) {
  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/nutrition" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Planos alimentares
      </Link>
      <Suspense fallback={<div role="status" className="h-[32rem] animate-pulse rounded-xl bg-muted" aria-label="Carregando plano" />}>
        <Builder params={params} />
      </Suspense>
    </div>
  );
}
