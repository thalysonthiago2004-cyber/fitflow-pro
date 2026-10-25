import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Utensils } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NutrientSummary, NutritionDisclaimer } from "@/components/nutrition/nutrient-summary";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { formatKcal, formatQuantity, macroLine } from "@/lib/nutrition/format";
import { getStudentMealPlans } from "@/lib/nutrition/queries";

export const metadata: Metadata = { title: "Minha dieta" };

async function MealsContent() {
  const user = await requireUser();
  if (user.role !== "student") redirect("/nutrition");
  const plans = await getStudentMealPlans(user.id);

  if (plans.length === 0) {
    return <EmptyState icon={Utensils} title="Nenhum plano alimentar ainda" description="Quando seu personal publicar um plano alimentar, ele aparece aqui." />;
  }

  return (
    <div className="grid gap-10">
      {plans.map((plan) => (
        <section key={plan.id} aria-labelledby={`plan-${plan.id}`} className="grid gap-4">
          <h2 id={`plan-${plan.id}`} className="font-heading text-xl font-semibold">{plan.name}</h2>
          {plan.notes && <p className="rounded-xl border bg-card p-4 text-sm whitespace-pre-line">{plan.notes}</p>}
          <Card className="py-5 [--card-spacing:--spacing(5)]">
            <CardContent className="grid gap-4">
              <NutrientSummary totals={plan.totals} label="Total diário estimado" />
            </CardContent>
          </Card>
          {plan.meals.filter((m) => m.items.length > 0).map((meal) => (
            <Card key={meal.id} className="gap-3 py-5 [--card-spacing:--spacing(5)]">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  <h3>{meal.timeOfDay && <span className="tabular-nums text-muted-foreground">{meal.timeOfDay} · </span>}{meal.name}</h3>
                </CardTitle>
                <CardDescription>≈ {formatKcal(meal.totals.kcal)} · {macroLine(meal.totals)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {meal.notes && <p className="text-sm">{meal.notes}</p>}
                <ul className="grid gap-2">
                  {meal.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b pb-2 last:border-0 last:pb-0">
                      <span className="font-medium">{item.food.name}</span>
                      <span className="text-sm tabular-nums">{formatQuantity(item.quantity, item.unit, item.food)}</span>
                      {item.notes && <span className="w-full text-sm text-muted-foreground">{item.notes}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
          <NutritionDisclaimer sources={plan.sources} />
        </section>
      ))}
    </div>
  );
}

export default function MealsPage() {
  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader title="Minha dieta" description="Refeições, quantidades e estimativas do seu plano alimentar." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando plano alimentar" />}>
        <MealsContent />
      </Suspense>
    </div>
  );
}
