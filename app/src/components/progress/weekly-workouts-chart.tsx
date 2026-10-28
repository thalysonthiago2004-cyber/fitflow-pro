"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";
import { ChartTable, ChartTooltip } from "./chart-tooltip";

const short = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const tick = (week: string) => short.format(new Date(`${week}T12:00:00Z`));
const plural = (n: number) => `${n} ${n === 1 ? "treino" : "treinos"}`;

// Columns ≤24px with a 4px rounded data end and a square baseline.
export function WeeklyWorkoutsChart({ weeks, period }: { weeks: { week: string; count: number }[]; /** Overrides "nas últimas N semanas". */ period?: string }) {
  const total = weeks.reduce((s, w) => s + w.count, 0);
  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-base font-semibold">Treinos concluídos por semana</span>
        <span className="text-sm text-muted-foreground">{plural(total)} {period ?? `nas últimas ${weeks.length} semanas`}</span>
      </figcaption>
      {total === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum treino concluído nesse período.</p>
      ) : (
        <BarChart responsive style={{ width: "100%", height: 200 }} data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis dataKey="week" tickFormatter={tick} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <ChartTooltip value={plural(Number(payload[0].value))} label={`Semana de ${formatDate(String(payload[0].payload.week))}`} />
              ) : null
            }
          />
          <Bar dataKey="count" fill="var(--chart-2)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      )}
      <ChartTable caption="Treinos por semana" headers={["Semana de", "Treinos"]} rows={[...weeks].reverse().map((w) => [formatDate(w.week), String(w.count)])} />
    </figure>
  );
}
