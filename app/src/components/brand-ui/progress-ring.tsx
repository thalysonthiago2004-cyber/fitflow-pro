import { cn } from "@/lib/utils";

type ProgressRingProps = {
  /** 0–1; values above 1 render as a full ring. */
  value: number | null;
  size?: number;
  stroke?: number;
  center: string;
  caption?: string;
  label: string;
  className?: string;
  /** Force the night palette (for previews rendered on a fixed dark surface). */
  night?: boolean;
};

// Ring meter: lime fill on a lighter step of the same hue. The number is
// always printed in the center, so the ring is never the only carrier.
export function ProgressRing({ value, size = 160, stroke = 14, center, caption, label, className, night = false }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value));

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={night ? "rgb(183 243 74 / 0.14)" : "var(--meter-track)"} strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={night ? "#b7f34a" : "var(--meter-fill)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            className={cn(
              "transition-[stroke-dasharray] duration-500 motion-reduce:transition-none",
              night ? "drop-shadow-[0_0_8px_rgb(183_243_74/0.55)]" : "dark:drop-shadow-[0_0_10px_rgb(183_243_74/0.55)]",
            )}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center" aria-hidden>
        <span className="font-heading text-3xl font-extrabold tracking-tight tabular-nums">{center}</span>
        {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
      </div>
    </div>
  );
}
