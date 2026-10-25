"use client";

import { Apple, ClipboardList, Droplets, Dumbbell, Scale, TrendingUp, Utensils, LayoutDashboard, Settings, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceRole } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { type NavKey, navItemsFor } from "./nav-items";

// Icons live on the client side: components cannot be passed from the server.
const ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  students: Users,
  workouts: ClipboardList,
  exercises: Dumbbell,
  training: Dumbbell,
  hydration: Droplets,
  progress: TrendingUp,
  assessments: Scale,
  nutrition: Utensils,
  foods: Apple,
  meals: Utensils,
  settings: Settings,
};

// On mobile the libraries live inside their section tab.
const MOBILE_ALIASES: Partial<Record<NavKey, string[]>> = { workouts: ["/exercises"], nutrition: ["/foods"], dashboard: ["/hydration"] };

const SHORT_LABELS: Partial<Record<NavKey, string>> = { settings: "Ajustes", hydration: "Água" };

type AppNavProps = { variant: "sidebar" | "bottom"; role: WorkspaceRole | undefined };

export function AppNav({ variant, role }: AppNavProps) {
  const pathname = usePathname();
  const isSidebar = variant === "sidebar";
  const items = navItemsFor(role, variant);

  return (
    <ul
      className={cn(isSidebar ? "grid gap-1" : "grid")}
      style={isSidebar ? undefined : { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map(({ key, href, label }) => {
        // Short labels keep five tabs legible on 320 px screens; the full name stays accessible.
        const Icon = ICONS[key];
        const section = isSidebar ? [href] : [href, ...(MOBILE_ALIASES[key] ?? [])];
        const active = section.some((path) => pathname === path || pathname.startsWith(`${path}/`));
        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={!isSidebar && SHORT_LABELS[key] ? label : undefined}
              className={cn(
                "relative flex items-center font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isSidebar
                  ? "h-11 gap-3 rounded-xl px-3 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-foreground before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-1 before:rounded-full before:bg-brand before:opacity-0 aria-[current=page]:before:opacity-100"
                  : "h-16 flex-col justify-center gap-1 rounded-xl text-[11px] text-muted-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground dark:aria-[current=page]:text-brand before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:bg-brand before:opacity-0 aria-[current=page]:before:opacity-100 dark:before:hidden",
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  isSidebar && active && "dark:text-brand",
                )}
                aria-hidden
              />
              {isSidebar ? label : <span className="max-w-full truncate px-0.5">{SHORT_LABELS[key] ?? label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppNavSkeleton({ variant }: { variant: "sidebar" | "bottom" }) {
  return variant === "sidebar" ? (
    <div className="grid gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-sidebar-accent" />
      ))}
    </div>
  ) : (
    <div className="h-16" aria-hidden />
  );
}
