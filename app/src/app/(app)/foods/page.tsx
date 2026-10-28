import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Apple, ChevronRight, Plus, Search, Download } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/auth/dal";
import { formatNumber } from "@/lib/format";
import { listFoods } from "@/lib/nutrition/queries";
import { normalize } from "@/lib/text";

export const metadata: Metadata = { title: "Alimentos" };


async function FoodsContent({ searchParams }: Pick<PageProps<"/foods">, "searchParams">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const user = await requireStaff();
  const foods = await listFoods(user.workspace.id);
  const visible = foods.filter((f) => !query || normalize(f.name).includes(normalize(query)));

  return (
    <div className="grid gap-6">
      <form role="search" action="/foods" className="relative max-w-md">
        <label htmlFor="food-search" className="sr-only">Buscar alimento</label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="food-search" name="q" type="search" defaultValue={query} placeholder="Buscar alimento" className="pl-9" />
      </form>
      {visible.length === 0 ? (
        <EmptyState
          icon={Apple}
          title={query ? "Nenhum alimento encontrado" : "Sua lista de alimentos está vazia"}
          description={query ? "Tente outro termo." : "Cadastre os alimentos com a informação nutricional e a fonte. Eles ficam disponíveis para todos os seus planos."}
          action={!query ? <Link href="/foods/new" className={buttonVariants()}><Plus aria-hidden />Cadastrar alimento</Link> : undefined}
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map((food) => (
            <li key={food.id}>
              <Link href={`/foods/${food.id}`} className="flex items-center gap-3 surface-row p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="truncate font-medium">{food.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatNumber(food.kcalPer100, 0)} kcal por 100 {food.basis}
                    {food.unitLabel && ` · 1 ${food.unitLabel} = ${formatNumber(food.unitAmount!, 1)} ${food.basis}`}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FoodsPage({ searchParams }: PageProps<"/foods">) {
  return (
    <div className="grid gap-6">
      <BackLink href="/nutrition" className="lg:hidden">Nutrição</BackLink>
      <PageHeader
        title="Alimentos"
        description="Informação nutricional por 100 g ou 100 ml, sempre com a fonte."
        actions={
          <>
            <Link href="/foods/taco" className={buttonVariants({ variant: "outline" })}><Download aria-hidden />Importar da TACO</Link>
            <Link href="/foods/new" className={buttonVariants()}><Plus aria-hidden />Novo alimento</Link>
          </>
        }
      />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Carregando alimentos" />}>
        <FoodsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
