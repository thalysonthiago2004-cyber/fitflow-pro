import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Dumbbell, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/auth/dal";
import { normalize } from "@/lib/text";
import type { MuscleGroup } from "@/lib/supabase/database.types";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/workouts/labels";
import { listExercises } from "@/lib/workouts/queries";

export const metadata: Metadata = { title: "Exercícios" };

async function ExercisesContent({ searchParams }: Pick<PageProps<"/exercises">, "searchParams">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const group = typeof params.group === "string" && params.group in MUSCLE_GROUP_LABELS ? (params.group as MuscleGroup) : "";
  const scope = params.scope === "mine" ? "mine" : "all";

  await requireStaff();
  const exercises = await listExercises();
  const needle = normalize(query);
  const visible = exercises.filter(
    (e) =>
      (!needle || normalize(e.name).includes(needle)) &&
      (!group || e.muscleGroup === group) &&
      (scope === "all" || !e.isGlobal),
  );

  return (
    <div className="grid gap-6">
      <form role="search" action="/exercises" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_12rem_auto]">
        <div className="relative">
          <label htmlFor="exercise-search" className="sr-only">Buscar exercício</label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="exercise-search" name="q" type="search" defaultValue={query} placeholder="Buscar exercício" className="pl-9" />
        </div>
        <div>
          <label htmlFor="exercise-group" className="sr-only">Grupo muscular</label>
          <select id="exercise-group" name="group" defaultValue={group} className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 [&>option]:bg-popover">
            <option value="">Todos os grupos</option>
            {Object.entries(MUSCLE_GROUP_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="exercise-scope" className="sr-only">Origem</label>
          <select id="exercise-scope" name="scope" defaultValue={scope} className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 [&>option]:bg-popover">
            <option value="all">Todos</option>
            <option value="mine">Só os meus</option>
          </select>
        </div>
        <button type="submit" className={buttonVariants({ variant: "secondary" })}>Filtrar</button>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {visible.length === 1 ? "1 exercício" : `${visible.length} exercícios`}
      </p>

      {visible.length === 0 ? (
        <EmptyState icon={Dumbbell} title="Nenhum exercício encontrado" description="Ajuste os filtros ou crie um exercício novo." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <Link
                href={`/exercises/${exercise.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="truncate font-medium">{exercise.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {MUSCLE_GROUP_LABELS[exercise.muscleGroup]} · {EQUIPMENT_LABELS[exercise.equipment]}
                    {!exercise.isGlobal && " · Meu"}
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

export default function ExercisesPage({ searchParams }: PageProps<"/exercises">) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Exercícios"
        description="Biblioteca padrão e exercícios criados por você."
        actions={
          <Link href="/exercises/new" className={buttonVariants()}>
            <Plus aria-hidden />
            Novo exercício
          </Link>
        }
      />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando exercícios" />}>
        <ExercisesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
