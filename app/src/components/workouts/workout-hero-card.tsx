import Link from "next/link";
import { ArrowRight, Dumbbell, Play } from "lucide-react";
import { formatWeekdays } from "@/lib/workouts/labels";
import type { SessionDetail } from "@/lib/workouts/queries";
import { cn } from "@/lib/utils";

type Props = {
  session: SessionDetail;
  eyebrow: string;
  href: string;
  cta: string;
  inProgress?: boolean;
};

// The day's main action. Typography and a lime glow stand in for photography.
export function WorkoutHeroCard({ session, eyebrow, href, cta, inProgress = false }: Props) {
  const strength = session.exercises.flatMap((e) => (e.kind === "strength" ? [e] : []));
  const sets = strength.reduce((sum, e) => sum + e.sets, 0);
  const cardio = session.exercises.length - strength.length;
  const muscles = [...new Set(session.exercises.map((e) => e.exercise.name))].slice(0, 3);

  return (
    <Link
      href={href}
      className="group relative isolate block overflow-hidden surface-hero bg-brand-glow p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6 dark:glow-brand"
    >
      <Dumbbell
        className="pointer-events-none absolute -right-6 -bottom-8 -z-10 size-44 -rotate-12 text-foreground/[0.04] dark:text-brand/[0.07]"
        strokeWidth={1.25}
        aria-hidden
      />
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <span className={cn("text-xs font-semibold tracking-wide uppercase", inProgress ? "text-foreground dark:text-brand" : "text-muted-foreground")}>
            {eyebrow}
          </span>
          <span className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{session.name}</span>
          <span className="text-sm text-muted-foreground">
            {[
              strength.length > 0 && `${strength.length} ${strength.length === 1 ? "exercício" : "exercícios"} · ${sets} séries`,
              cardio > 0 && `${cardio} cardio`,
              formatWeekdays(session.weekdays),
            ].filter(Boolean).join(" · ")}
          </span>
          {muscles.length > 0 && <span className="truncate text-sm text-muted-foreground">{muscles.join(" · ")}</span>}
        </div>
        <span className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
          {inProgress ? <ArrowRight className="size-4" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
          {cta}
        </span>
      </div>
    </Link>
  );
}
