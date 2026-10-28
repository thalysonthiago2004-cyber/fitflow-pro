import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A row of filter or sort chips: one line that scrolls sideways on phones
// (edge to edge, like native apps) and wraps on larger screens. Inline-size
// containment keeps the chips from widening the page: the row takes the
// width it is given and scrolls inside it.
export function ChipRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 [contain:inline-size] sm:mx-0 sm:overflow-visible sm:px-0 sm:[contain:none]", className)}>
      <div className="flex w-max items-center gap-2 pb-1 sm:w-auto sm:flex-wrap sm:pb-0 [&>*]:shrink-0">{children}</div>
    </nav>
  );
}
