import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
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
      <BackLink href="/foods">Alimentos</BackLink>
      <PageHeader
        title="Importar da TACO"
        description="Tabela Brasileira de Composição de Alimentos, 4ª edição (NEPA/UNICAMP, 2011). Valores por 100 g da parte comestível; a fonte fica registrada em cada alimento e você pode ajustar depois."
      />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Carregando tabela" />}>
        <Content />
      </Suspense>
    </div>
  );
}
