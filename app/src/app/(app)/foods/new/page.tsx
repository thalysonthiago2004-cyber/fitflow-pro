import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { FoodForm } from "@/components/nutrition/food-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/dal";
import { createFood } from "../actions";

export const metadata: Metadata = { title: "Novo alimento" };

async function AuthorizedForm() {
  await requireStaff();
  return <FoodForm action={createFood} submitLabel="Cadastrar alimento" />;
}

export default function NewFoodPage() {
  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/foods" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Alimentos
      </Link>
      <PageHeader title="Novo alimento" description="Copie os valores do rótulo ou de uma tabela de composição e informe a fonte." />
      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardContent>
          <Suspense fallback={<div className="h-96" aria-hidden />}>
            <AuthorizedForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
