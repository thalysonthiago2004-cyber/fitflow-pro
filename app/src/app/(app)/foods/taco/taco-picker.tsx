"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { TacoFood } from "@/lib/nutrition/taco";
import { importTacoFoods } from "../actions";

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function TacoPicker({ foods, existing }: { foods: TacoFood[]; existing: string[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const taken = useMemo(() => new Set(existing.map((n) => n.toLowerCase())), [existing]);
  const categories = useMemo(() => [...new Set(foods.map((f) => f.category))], [foods]);
  const visible = foods.filter((f) => (!category || f.category === category) && (!query || normalize(f.name).includes(normalize(query))));
  const available = visible.filter((f) => !taken.has(f.name.toLowerCase()));

  function toggle(item: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  function submit(items: number[]) {
    startTransition(async () => {
      const result = await importTacoFoods(items);
      if (!result.ok) return void toast.error(result.message);
      setSelected(new Set());
      toast.success(`${result.added} ${result.added === 1 ? "alimento importado" : "alimentos importados"}${result.skipped ? ` · ${result.skipped} já estavam na biblioteca` : ""}.`);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative">
          <label htmlFor="taco-search" className="sr-only">Buscar alimento</label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="taco-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar: arroz, frango, banana…" className="pl-9" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="taco-category" className="sr-only">Categoria</label>
          <select id="taco-category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 [&>option]:bg-popover">
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-y bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border lg:top-2">
        <span className="flex-1 text-sm text-muted-foreground" aria-live="polite">{visible.length} alimentos · {selected.size} selecionados</span>
        <Button type="button" variant="outline" disabled={pending || available.length === 0} onClick={() => submit(available.map((f) => f.item))}>
          Importar os {available.length} listados
        </Button>
        <Button type="button" disabled={pending || selected.size === 0} onClick={() => submit([...selected])}>
          <Download aria-hidden />
          Importar selecionados
        </Button>
      </div>

      <ul className="grid gap-1.5">
        {visible.slice(0, 200).map((f) => {
          const inLibrary = taken.has(f.name.toLowerCase());
          const id = `taco-${f.item}`;
          return (
            <li key={f.item}>
              <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 has-disabled:cursor-default has-disabled:opacity-60 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                <input id={id} type="checkbox" className="size-5 shrink-0 accent-[var(--brand)]" checked={selected.has(f.item)} disabled={inLibrary} onChange={() => toggle(f.item)} />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">{f.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatNumber(f.kcal, 0)} kcal · P {formatNumber(f.protein, 1)} g · C {formatNumber(f.carbs, 1)} g · G {formatNumber(f.fat, 1)} g{f.fiber !== null ? ` · fibra ${formatNumber(f.fiber, 1)} g` : ""} · por 100 g
                  </span>
                </span>
                {inLibrary && <span className="text-xs text-muted-foreground">Na biblioteca</span>}
              </label>
            </li>
          );
        })}
      </ul>
      {visible.length > 200 && <p className="text-sm text-muted-foreground">Mostrando 200 de {visible.length}. Refine a busca para ver os demais.</p>}
    </div>
  );
}
