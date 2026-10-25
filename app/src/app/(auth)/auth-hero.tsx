import { ChartNoAxesCombined, Dumbbell, Utensils } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const FEATURES = [
  { icon: Dumbbell, label: "Treinos" },
  { icon: Utensils, label: "Nutrição" },
  { icon: ChartNoAxesCombined, label: "Evolução" },
];

// Always dark, whatever the theme: the photos are low-key and the lime
// headline needs the dark surface for contrast.
export function AuthHero() {
  return (
    <section aria-label="FitFlow Pro" className="dark relative isolate overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 -z-10 grid grid-cols-2" aria-hidden>
        <div className="relative">
          <Image src="/auth/hero-male.jpg" alt="" fill preload sizes="(min-width: 1024px) 28vw, 50vw" className="object-cover object-top" />
        </div>
        <div className="relative">
          <Image src="/auth/hero-female.jpg" alt="" fill preload sizes="(min-width: 1024px) 28vw, 50vw" className="object-cover object-top" />
        </div>
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/60 to-background/20" aria-hidden />

      <div className="flex h-full min-h-72 flex-col justify-between gap-8 p-5 sm:p-10 lg:min-h-dvh lg:gap-10 lg:p-12">
        <Link href="/" className="w-fit rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <BrandLogo size={32} className="lg:[&_svg]:size-9" />
          <span className="sr-only">Página inicial</span>
        </Link>

        <div className="grid max-w-md gap-3 lg:gap-5">
          <p className="hidden text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase lg:block">Saúde · Disciplina · Evolução</p>
          <p className="font-heading text-3xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-5xl lg:text-6xl">
            Pequenos passos.
            <span className="block text-brand">Grandes resultados.</span>
          </p>
          <span className="hidden h-1 w-14 rounded-full bg-brand lg:block" aria-hidden />
          <p className="hidden text-muted-foreground sm:block lg:text-base">Treino, nutrição e evolução do aluno num só lugar — do personal para o celular de quem treina.</p>
          <ul className="hidden gap-8 pt-4 lg:flex">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="grid justify-items-start gap-2 text-sm font-medium">
                <Icon className="size-6 text-brand" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
