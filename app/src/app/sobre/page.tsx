import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, Droplets, Dumbbell, Flame, Smartphone, Users, Zap } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { IconTile } from "@/components/brand-ui/icon-tile";
import { ProgressRing } from "@/components/brand-ui/progress-ring";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

const FEATURES = [
  { icon: Dumbbell, title: "Treinos sob medida", text: "Monte planos com séries, cargas e descanso para cada aluno." },
  { icon: Smartphone, title: "Registro no celular", text: "O aluno treina com o plano na mão e registra cada série." },
  { icon: ChartNoAxesCombined, title: "Evolução visível", text: "Medidas, recordes e constância calculados a partir do que foi registrado." },
  { icon: Droplets, title: "Dieta e hidratação", text: "Planos alimentares com estimativas e metas de água no mesmo lugar." },
];

// Illustrative device preview built from the real UI pieces. Numbers inside it
// are example values for the marketing page, not data from any account.
function PhonePreview() {
  return (
    <figure className="relative mx-auto w-full max-w-[19rem]" aria-label="Ilustração do painel do aluno no celular">
      <div className="absolute -inset-10 -z-10 rounded-full bg-brand/20 blur-3xl dark:bg-brand/15" aria-hidden />
      <div className="rounded-[2.75rem] border-8 border-[#1c221d] bg-[#0a0d0b] p-4 text-[#f5f7f4] shadow-2xl" aria-hidden>
        <div className="mx-auto mb-4 h-5 w-24 rounded-full bg-[#1c221d]" />
        <div className="grid gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-extrabold">Olá, Carla</p>
              <p className="text-[11px] text-[#a3aea4]">Pronto para o treino de hoje?</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-[#252d26] px-2 py-1">
              <Flame className="size-4 text-[#b7f34a]" />
              <span className="text-sm font-extrabold">4</span>
            </div>
          </div>
          <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-[#252d26] bg-[#121713] p-3">
            <ProgressRing value={0.72} size={92} stroke={9} center="72%" label="" night className="[&_span:first-child]:text-lg" />
            <div className="grid gap-2 text-[11px]">
              <span><span className="text-[#a3aea4]">Água</span><br /><b className="text-sm">1,8 L</b> <span className="text-[#a3aea4]">/ 2,5 L</span></span>
              <span><span className="text-[#a3aea4]">Treinos na semana</span><br /><b className="text-sm">3</b></span>
            </div>
          </div>
          <div className="rounded-2xl border border-[#b7f34a]/30 bg-[#121713] bg-brand-glow p-4 shadow-[0_8px_32px_-8px_rgb(183_243_74/0.35)]">
            <p className="text-[10px] font-semibold tracking-wide text-[#a3aea4] uppercase">Treino de hoje</p>
            <p className="mt-1 text-base font-extrabold">Treino A — Superiores</p>
            <p className="text-[11px] text-[#a3aea4]">6 exercícios · 18 séries</p>
            <span className="mt-3 inline-flex h-8 items-center rounded-full bg-[#b7f34a] px-4 text-xs font-bold text-[#0a0d0b]">Iniciar</span>
          </div>
          <div className="grid grid-cols-5 border-t border-[#1c231d] pt-2 text-center text-[9px] text-[#a3aea4]">
            {["Painel", "Treinos", "Dieta", "Evolução", "Ajustes"].map((label, i) => (
              <span key={label} className={i === 0 ? "font-bold text-[#b7f34a]" : undefined}>{label}</span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">Ilustração com valores de exemplo</figcaption>
    </figure>
  );
}

export default function HomePage() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-[-10%] -z-10 size-[36rem] rounded-full bg-brand/10 blur-3xl dark:bg-brand/[0.08]" aria-hidden />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <BrandLogo size={32} />
        <nav aria-label="Conta" className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>Entrar</Link>
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-20">
        <section className="grid gap-8">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold tracking-wide uppercase">
            <Zap className="size-3.5 fill-current dark:text-brand" aria-hidden />
            Para personal trainers e seus alunos
          </p>
          <h1 className="font-heading text-[2.6rem] leading-[1.02] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Treino sob medida.{" "}
            <span className="relative whitespace-nowrap dark:text-brand">
              <span className="relative z-10">Evolução real.</span>
              <span className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded-sm bg-brand dark:hidden" aria-hidden />
            </span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            O personal monta o plano. O aluno treina, registra e acompanha a evolução pelo celular. Tudo em um só lugar.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ size: "lg", className: "glow-brand px-7" })}>
              Começar agora
              <ArrowRight aria-hidden />
            </Link>
            <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Já tenho conta
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <IconTile icon={icon} />
                <div className="grid gap-0.5">
                  <h2 className="text-sm font-bold tracking-wide uppercase">{title}</h2>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <PhonePreview />
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
        <span>© FitFlow Pro</span>
        <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden />Alunos entram por convite do personal</span>
      </footer>
    </div>
  );
}
