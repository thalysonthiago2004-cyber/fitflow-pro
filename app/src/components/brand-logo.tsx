import { cn } from "@/lib/utils";

type BrandMarkProps = {
  size?: number;
  className?: string;
  /** Provide a label only when the mark is shown without the wordmark. */
  title?: string;
};

// Geometric tile with an ascending stroke. The lime stroke always sits on the
// dark tile (14.1:1), so the mark reads on light and dark backgrounds alike.
export function BrandMark({ size = 32, className, title }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        fill="var(--brand-foreground)"
        className="stroke-transparent dark:stroke-border"
      />
      <g
        fill="none"
        stroke="var(--brand)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 22.5l5.5-5.5 4 3L24 12.5" />
        <path d="M19 12h5.5v5.5" />
      </g>
    </svg>
  );
}

type BrandLogoProps = {
  size?: number;
  className?: string;
  showWordmark?: boolean;
};

export function BrandLogo({ size = 32, className, showWordmark = true }: BrandLogoProps) {
  if (!showWordmark) return <BrandMark size={size} className={className} title="FitFlow Pro" />;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <span
        className="font-heading leading-none font-bold tracking-tight text-foreground"
        style={{ fontSize: Math.round(size * 0.56) }}
      >
        FitFlow <span className="font-medium text-muted-foreground">Pro</span>
      </span>
    </span>
  );
}
