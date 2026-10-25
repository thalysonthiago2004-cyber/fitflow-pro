import { macroSplit, type Nutrients } from "@/lib/nutrition/calc";
import { formatGrams, formatKcal } from "@/lib/nutrition/format";

type Props = { totals: Nutrients; label?: string; size?: "lg" | "sm" };

// Always presented as an estimate: values come from the per-100 data entered
// for each food, not from lab measurements of the actual meal.
export function NutrientSummary({ totals, label = "Total estimado", size = "lg" }: Props) {
  const split = macroSplit(totals);
  const macros = [
    { name: "Proteínas", value: totals.protein, pct: split?.protein },
    { name: "Carboidratos", value: totals.carbs, pct: split?.carbs },
    { name: "Gorduras", value: totals.fat, pct: split?.fat },
    { name: "Fibras", value: totals.fiber, pct: undefined },
  ];

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={size === "lg" ? "font-heading text-3xl font-semibold tabular-nums" : "text-lg font-semibold tabular-nums"}>
          ≈ {formatKcal(totals.kcal)}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {macros.map((m) => (
          <div key={m.name} className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{m.name}</dt>
            <dd className="text-sm font-medium tabular-nums">
              {m.value === null ? "Sem dado" : `≈ ${formatGrams(m.value)}`}
              {m.pct !== undefined && <span className="font-normal text-muted-foreground"> · {m.pct}% kcal</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function NutritionDisclaimer({ sources }: { sources: string[] }) {
  return (
    <div className="grid gap-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
      <p>
        Valores estimados a partir das informações nutricionais cadastradas para cada alimento. Podem variar conforme
        marca, preparo e porção. Não substituem orientação de nutricionista.
      </p>
      {sources.length > 0 && <p>Fontes: {sources.join("; ")}.</p>}
    </div>
  );
}
