"use client";

import { CartesianGrid, LabelList, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatNumber } from "@/lib/format";
import { ChartTable, ChartTooltip } from "./chart-tooltip";

type Point = { date: string; value: number };

const short = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const tick = (date: string) => short.format(new Date(`${date}T12:00:00Z`));

// Single series: the title names it, so no legend. 2px line, ≥8px dots with a
// surface ring, hairline solid grid, value labeled at the end only.
export function WeightChart({ points, unit = "kg", title = "Peso" }: { points: Point[]; unit?: string; title?: string }) {
  if (points.length < 2) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Registre pelo menos duas medições de {title.toLowerCase()} para ver a evolução.
      </p>
    );
  }
  const values = points.map((p) => p.value);
  const pad = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.2);
  // Five evenly spaced whole-number ticks around the data.
  const lo = Math.floor(Math.min(...values) - pad);
  const step = Math.max(1, Math.ceil((Math.max(...values) + pad - lo) / 4));
  const ticks = Array.from({ length: 5 }, (_, i) => lo + i * step);
  const lastIndex = points.length - 1;

  return (
    <figure className="grid gap-3">
      <figcaption className="font-heading text-base font-semibold">{title} ({unit})</figcaption>
      <LineChart
        responsive
        style={{ width: "100%", height: 240 }}
        data={points}
        margin={{ top: 20, right: 40, bottom: 0, left: 0 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
        <XAxis dataKey="date" tickFormatter={tick} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} minTickGap={24} />
        <YAxis
          domain={[ticks[0], ticks[4]]}
          ticks={ticks}
          tickFormatter={(v: number) => formatNumber(v, 0)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.[0] ? (
              <ChartTooltip value={`${formatNumber(Number(payload[0].value), 1)} ${unit}`} label={formatDate(String(payload[0].payload.date))} />
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--chart-2)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={{ r: 4, fill: "var(--chart-2)", stroke: "var(--card)", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "var(--chart-2)", stroke: "var(--card)", strokeWidth: 2 }}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            content={({ x, y, value, index }) =>
              index === lastIndex ? (
                <text x={Number(x) + 8} y={Number(y) - 8} fill="var(--foreground)" fontSize={12} fontWeight={600}>
                  {formatNumber(Number(value), 1)}
                </text>
              ) : null
            }
          />
        </Line>
      </LineChart>
      <ChartTable caption={`${title} por data`} headers={["Data", `${title} (${unit})`]} rows={[...points].reverse().map((p) => [formatDate(p.date), formatNumber(p.value, 1)])} />
    </figure>
  );
}
