import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Lime icon chip. Lime is never used as a foreground on light surfaces, so the
// light theme gets a solid lime tile with a dark icon instead.
export function IconTile({ icon: Icon, size = "md", className }: { icon: LucideIcon; size?: "sm" | "md" | "lg"; className?: string }) {
  const box = { sm: "size-9 rounded-lg", md: "size-11 rounded-xl", lg: "size-12 rounded-2xl" }[size];
  const glyph = { sm: "size-4", md: "size-5", lg: "size-6" }[size];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-brand text-brand-foreground dark:bg-brand/10 dark:text-brand dark:ring-1 dark:ring-brand/25",
        box,
        className,
      )}
      aria-hidden
    >
      <Icon className={glyph} />
    </span>
  );
}
