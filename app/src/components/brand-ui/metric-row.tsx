import type { LucideIcon } from "lucide-react";
import { IconTile } from "./icon-tile";

export function MetricRow({ icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={icon} size="sm" />
      <div className="grid min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="truncate text-base font-bold tabular-nums">
          {value}
          {detail && <span className="text-sm font-normal text-muted-foreground"> {detail}</span>}
        </span>
      </div>
    </div>
  );
}
