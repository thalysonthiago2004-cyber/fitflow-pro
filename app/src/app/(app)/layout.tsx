import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Suspense } from "react";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReminderRunner } from "@/components/hydration/reminder-runner";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/roles";
import { getCurrentGoal, getDailyTotals, getReminders } from "@/lib/hydration/queries";
import { AppNav, AppNavSkeleton } from "./app-nav";
import { avatarUrl } from "@/lib/images/urls";
import { GlobalSearch } from "./global-search";
import { SIDEBAR_BOOT, SidebarToggle } from "./sidebar-toggle";
import { UserMenu } from "./user-menu";

async function RoleNav({ variant }: { variant: "sidebar" | "bottom" }) {
  const user = await requireUser();
  return <AppNav variant={variant} role={user.workspace?.role} />;
}

async function StudentReminders() {
  const user = await requireUser();
  if (user.role !== "student" || !user.workspace) return null;
  const [prefs, goal, days] = await Promise.all([getReminders(user.id), getCurrentGoal(user.id), getDailyTotals(user.id, 1)]);
  if (!prefs.enabled) return null;
  return <ReminderRunner prefs={prefs} goalReached={goal !== null && days[0].totalMl >= goal} />;
}

async function CurrentUserMenu({ compact, side }: { compact?: boolean; side?: "top" | "bottom" }) {
  const user = await requireUser();
  return <UserMenu fullName={user.fullName} email={user.email} avatarUrl={avatarUrl(user.avatarPath)} compact={compact} side={side} />;
}

async function StaffSearch() {
  const user = await requireUser();
  return isStaffRole(user.workspace?.role) ? <GlobalSearch /> : null;
}

// The shell is static and prerenders; only session-dependent parts stream in.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)] lg:sidebar-collapsed:grid-cols-[76px_minmax(0,1fr)] print:block">
      <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOT }} />
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-background px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-3 focus:ring-ring/50"
      >
        Pular para o conteúdo
      </a>

      {/* The column paints the sidebar background for the full page height; the aside stays pinned. */}
      <div className="hidden border-r border-sidebar-border bg-sidebar lg:block print:hidden">
        <aside id="app-sidebar" className="sticky top-0 flex h-dvh flex-col p-4 sidebar-collapsed:px-3">
          <div className="flex items-center justify-between px-2 pb-6 sidebar-collapsed:flex-col sidebar-collapsed:gap-3 sidebar-collapsed:px-0">
            <Link href="/dashboard" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <BrandLogo size={30} className="sidebar-collapsed:hidden" />
              <BrandMark size={32} className="hidden sidebar-collapsed:block" />
              <span className="sr-only">Ir para o painel</span>
            </Link>
            <SidebarToggle />
          </div>
          <nav aria-label="Navegação principal" className="flex-1">
            <Suspense fallback={<AppNavSkeleton variant="sidebar" />}>
              <RoleNav variant="sidebar" />
            </Suspense>
          </nav>
          <div className="sidebar-collapsed:hidden">
            <Suspense fallback={<div className="h-14 animate-pulse rounded-lg bg-muted" />}>
              <CurrentUserMenu />
            </Suspense>
          </div>
          <div className="hidden justify-center sidebar-collapsed:flex">
            <Suspense fallback={<div className="size-11 animate-pulse rounded-full bg-muted" />}>
              <CurrentUserMenu compact side="top" />
            </Suspense>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden print:hidden">
          <Link href="/dashboard" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <BrandLogo size={28} />
            <span className="sr-only">Ir para o painel</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/assistant"
              className="flex size-11 items-center justify-center rounded-full text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Sparkles className="size-5" aria-hidden />
              <span className="sr-only">Assistente</span>
            </Link>
            <ThemeToggle />
            <Suspense fallback={<div className="size-11 animate-pulse rounded-full bg-muted" />}>
              <CurrentUserMenu compact />
            </Suspense>
          </div>
        </header>

        <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b bg-background/95 px-10 backdrop-blur lg:flex print:hidden">
          <Suspense fallback={null}>
            <StaffSearch />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/assistant" className={buttonVariants({ variant: "ghost" })}>
              <Sparkles aria-hidden />
              Assistente
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12 print:max-w-none print:p-0">
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <StudentReminders />
      </Suspense>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
      >
        <Suspense fallback={<AppNavSkeleton variant="bottom" />}>
          <RoleNav variant="bottom" />
        </Suspense>
      </nav>
    </div>
  );
}
