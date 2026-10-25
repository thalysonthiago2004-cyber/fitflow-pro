import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { FoodForm } from "@/components/nutrition/food-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/dal";
import { getFood } from "@/lib/nutrition/queries";
import { updateFood } from "../actions";
import { ArchiveFoodButton } from "./archive-food-button";

export const metadata: Metadata = { title: "Alimento" };

async function FoodContent({ params }: Pick<PageProps<"/foods/[foodId]">, "params">) {
  const { foodId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(foodId)) notFound();
  const user = await requireStaff();
  const food = await getFood(foodId, user.workspace.id);
  if (!food) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader title={food.name} description={`Valores por 100 ${food.basis} · Fonte: ${food.source}`} />
      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardContent>
          <FoodForm action={updateFood.bind(null, food.id)} food={food} submitLabel="Salvar alterações" />
        </CardContent>
      </Card>
      <div>
        <ArchiveFoodButton foodId={food.id} name={food.name} />
      </div>
    </div>
  );
}

export default function FoodPage({ params }: PageProps<"/foods/[foodId]">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/foods" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Alimentos
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando alimento" />}>
        <FoodContent params={params} />
      </Suspense>
    </div>
  );
}
