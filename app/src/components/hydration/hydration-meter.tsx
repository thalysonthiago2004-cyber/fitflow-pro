import { formatVolume } from "@/lib/format";

// Today's intake against the configured target. The track is a lighter step of
// the same hue as the fill; the numbers are always spelled out.
export function HydrationMeter({ totalMl, goalMl }: { totalMl: number; goalMl: number | null }) {
  const pct = goalMl ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;
  const reached = goalMl !== null && totalMl >= goalMl;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="font-heading text-4xl font-semibold tabular-nums">{formatVolume(totalMl)}</p>
        <p className="text-sm text-muted-foreground">
          {goalMl ? (reached ? `Meta de ${formatVolume(goalMl)} atingida` : `de ${formatVolume(goalMl)} · ${pct}%`) : "Sem meta definida"}
        </p>
      </div>
      {goalMl !== null && (
        <div
          role="progressbar"
          aria-label="Hidratação de hoje"
          aria-valuemin={0}
          aria-valuemax={goalMl}
          aria-valuenow={Math.min(totalMl, goalMl)}
          aria-valuetext={`${formatVolume(totalMl)} de ${formatVolume(goalMl)}`}
          className="h-3 overflow-hidden rounded-full bg-chart-2/20"
        >
          <div className="h-full rounded-full bg-chart-2 transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
