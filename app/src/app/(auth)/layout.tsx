import { ThemeToggle } from "@/components/theme-toggle";
import { AuthHero } from "./auth-hero";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <AuthHero />
      <div className="relative isolate flex flex-col overflow-hidden">
        <div className="pointer-events-none absolute -top-48 right-[-20%] -z-10 size-[32rem] rounded-full bg-brand/10 blur-3xl dark:bg-brand/[0.08]" aria-hidden />
        <header className="flex items-center justify-end px-4 py-3 sm:px-6">
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
