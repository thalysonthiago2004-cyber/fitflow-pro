"use client";

import { useState } from "react";
import { formatDate, formatVolume } from "@/lib/format";
import { WEEKDAYS } from "@/lib/workouts/labels";
import type { DayTotal } from "@/lib/hydration/queries";

const PLOT_HEIGHT = 144;

function weekday(date: string) {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()].short;
}

// Single-series column chart: one hue, ≤24px columns with a 4px rounded data
// end, a hairline goal reference and per-column hover/focus readouts. The
// table below carries every value without relying on hover.
export function WeekChart({ days, goalMl, title = "Últimos 7 dias" }: { days: DayTotal[]; goalMl: number | null; title?: string }) {
  const [active, setActive] = useState<number | null>(null);
  // 20% headroom keeps the goal label inside the plot even when the goal is the maximum.
  const max = Math.max(goalMl ?? 0, ...days.map((d) => d.totalMl), 1000) * 1.2;
  const scale = (ml: number) => Math.round((ml / max) * PLOT_HEIGHT);
  const daysMet = goalMl ? days.filter((d) => d.totalMl >= goalMl).length : null;

  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-base font-semibold">{title}</span>
        {daysMet !== null && (
          <span className="text-sm text-muted-foreground">Meta atingida em {daysMet} de {days.length} dias</span>
        )}
      </figcaption>

      {days.every((d) => d.totalMl === 0) ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum registro de água nos últimos {days.length} dias.
        </p>
      ) : (
      <div className="relative" style={{ height: PLOT_HEIGHT + 28 }} onPointerLeave={() => setActive(null)}>
        <div className="absolute inset-x-0 border-t border-border" style={{ top: PLOT_HEIGHT }} aria-hidden />
        {goalMl !== null && (
          <div className="absolute inset-x-0 border-t border-muted-foreground/60" style={{ top: PLOT_HEIGHT - scale(goalMl) }} aria-hidden>
            <span className="absolute -top-5 right-0 bg-card px-1 text-xs text-muted-foreground">Meta {formatVolume(goalMl)}</span>
          </div>
        )}
        <ol className="absolute inset-x-0 top-0 grid h-full" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day, i) => {
            const isLast = i === days.length - 1;
            return (
              <li key={day.date} className="relative flex flex-col items-center">
                <button
                  type="button"
                  className="group relative flex w-full cursor-default justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  style={{ height: PLOT_HEIGHT }}
                  aria-label={`${weekday(day.date)}, ${formatDate(day.date)}: ${formatVolume(day.totalMl)}`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <span
                    className="absolute bottom-0 w-full max-w-6 rounded-t-[4px] bg-chart-2 transition-opacity group-hover:opacity-80 motion-reduce:transition-none"
                    style={{ height: Math.max(day.totalMl > 0 ? 2 : 0, scale(day.totalMl)) }}
                    aria-hidden
                  />
                </button>
                <span className={`mt-2 text-xs ${isLast ? "font-semibold text-foreground" : "text-muted-foreground"}`} aria-hidden>
                  {isLast ? "Hoje" : weekday(day.date)}
                </span>
                {active === i && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute z-10 grid -translate-y-full gap-0.5 rounded-md border bg-popover px-2 py-1 text-center text-xs whitespace-nowrap text-popover-foreground shadow-md"
                    style={{ top: PLOT_HEIGHT - scale(day.totalMl) - 4 }}
                  >
                    <strong className="text-sm tabular-nums">{formatVolume(day.totalMl)}</strong>
                    <span className="text-muted-foreground">{formatDate(day.date)}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      )}

      <details className="text-sm">
        <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Ver em tabela
        </summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-1.5 font-medium">Dia</th>
              <th scope="col" className="py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className="border-b last:border-0">
                <td className="py-1.5">{weekday(day.date)}, {formatDate(day.date)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatVolume(day.totalMl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
