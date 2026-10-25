import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "neutral" | "warning" | "info";

const TONES: Record<Tone, string> = {
  success: "border-success/40 bg-success/10 text-foreground",
  neutral: "border-border bg-muted text-muted-foreground",
  warning: "border-warning/40 bg-warning/10 text-foreground",
  info: "border-info/40 bg-info/10 text-foreground",
};

const DOTS: Record<Tone, string> = {
  success: "bg-success",
  neutral: "bg-muted-foreground",
  warning: "bg-warning",
  info: "bg-info",
};

// Status is always spelled out in text; the dot is decorative. Text uses the
// foreground color because hue-on-tint pairs fall below 4.5:1 in the light theme.
export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", TONES[tone])}>
      <span className={cn("size-1.5 rounded-full", DOTS[tone])} aria-hidden />
      {children}
    </Badge>
  );
}
