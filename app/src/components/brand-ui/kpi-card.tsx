import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Trend = {
  /** Signed change; null when there is nothing to compare with. */
  value: number | null;
  unit: "%" | "p.p.";
  /** e.g. "vs. 30 dias anteriores". */
  against: string;
};

type Props = { icon: LucideIcon; label: string; value: string; detail?: string; trend?: Trend; highlight?: boolean };

// One headline figure. The trend is spelled out with a sign and an icon, so
// direction never depends on color.
export function KpiCard({ icon: Icon, label, value, detail, trend, highlight = false }: Props) {
  const up = trend?.value !== null && trend?.value !== undefined && trend.value > 0;
  const down = trend?.value !== null && trend?.value !== undefined && trend.value < 0;
  const TrendIcon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <div className={cn("grid content-between gap-4 surface p-4 sm:p-5", highlight && "bg-brand-glow dark:glow-brand")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <div className="grid gap-1">
        <span className="font-heading text-3xl font-extrabold tracking-tight tabular-nums">{value}</span>
        {trend && (
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {trend.value === null ? (
              <span>Sem base para comparar</span>
            ) : (
              <>
                <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", up && "text-success", down && "text-destructive", !up && !down && "text-foreground")}>
                  <TrendIcon className="size-3.5" aria-hidden />
                  {trend.value > 0 ? "+" : trend.value < 0 ? "−" : ""}
                  {Math.abs(trend.value)}
                  {trend.unit === "%" ? "%" : " p.p."}
                </span>
                <span>{trend.against}</span>
              </>
            )}
          </span>
        )}
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </div>
    </div>
  );
}
