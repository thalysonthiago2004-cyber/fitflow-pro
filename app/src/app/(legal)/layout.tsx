import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <BrandLogo size={32} />
          <span className="sr-only">Página inicial</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-16 sm:px-6">
        <article className="grid gap-6 text-sm leading-relaxed [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-extrabold [&_h2]:mt-4 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
          {children}
        </article>
      </main>
    </div>
  );
}
