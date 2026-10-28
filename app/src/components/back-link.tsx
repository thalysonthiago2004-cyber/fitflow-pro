import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// "Back to the list" link above a page title: one style everywhere, with a
// comfortable tap target.
export function BackLink({ href, children, className }: { href: ComponentProps<typeof Link>["href"]; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "-ml-2 inline-flex h-9 w-fit items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
