import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/auth/dal";
import { listFoods } from "@/lib/nutrition/queries";
import { TACO_FOODS } from "@/lib/nutrition/taco";
import { TacoPicker } from "./taco-picker";

export const metadata: Metadata = { title: "Importar da TACO" };

async function Content() {
  const user = await requireStaff();
  const foods = await listFoods(user.workspace.id);
  return <TacoPicker foods={TACO_FOODS} existing={foods.map((f) => f.name)} />;
}

export default function TacoPage() {
  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/foods" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Alimentos
      </Link>
      <PageHeader
        title="Importar da TACO"
        description="Tabela Brasileira de Composição de Alimentos, 4ª edição (NEPA/UNICAMP, 2011). Valores por 100 g da parte comestível; a fonte fica registrada em cada alimento e você pode ajustar depois."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando tabela" />}>
        <Content />
      </Suspense>
    </div>
  );
}
