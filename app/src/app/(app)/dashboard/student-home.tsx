import Link from "next/link";
import {
  ArrowRight, CalendarClock, Check, ChevronRight, MapPin, Flame, HeartPulse, Layers, MessageCircle, MoonStar, Play, Sparkles, Timer, TrendingUp, Users, Utensils,
} from "lucide-react";
import { ProgressRing } from "@/components/brand-ui/progress-ring";
import { EmptyState } from "@/components/empty-state";
import { QuickAdd } from "@/components/hydration/quick-add";
import { buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import type { CurrentUser } from "@/lib/auth/dal";
import { SUGGESTIONS } from "@/lib/assistant/suggestions";
import { addDays, formatVolume, todayISO, weekdayToday } from "@/lib/format";
import { getCurrentGoal, getDailyTotals } from "@/lib/hydration/queries";
import { avatarUrl } from "@/lib/images/urls";
import { formatKcal } from "@/lib/nutrition/format";
import { getStudentMealPlans } from "@/lib/nutrition/queries";
import { whatsappLink } from "@/lib/phone";
import { weeklyStreak } from "@/lib/progress/calc";
import { getCompletedWorkoutDates } from "@/lib/progress/queries";
import { listUpcomingForStudent } from "@/lib/schedule/queries";
import { localDate, localTime } from "@/lib/schedule/time";
import { getLatestQuestionnaire } from "@/lib/students/questionnaire-queries";
import { getTrainer } from "@/lib/students/queries";
import { MUSCLE_GROUP_LABELS, WEEKDAYS } from "@/lib/workouts/labels";
import { type SessionDetail, getOpenLog, getStudentPlans } from "@/lib/workouts/queries";
import { type WeekDay, estimateMinutes, nextPlanned, weekSchedule } from "@/lib/workouts/schedule";
import { cn } from "@/lib/utils";

// The student's "today" screen: one clear next action (the workout), the week
// at a glance, and today's small habits. Lime marks only what matters.

const longToday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

function Chip({ icon: Icon, children }: { icon: typeof Timer; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-background/60 px-3 text-xs font-semibold tabular-nums">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {children}
    </span>
  );
}

function sessionStats(session: SessionDetail) {
  const strength = session.exercises.flatMap((e) => (e.kind === "strength" ? [e] : []));
  return {
    exercises: session.exercises.length,
    sets: strength.reduce((sum, e) => sum + e.sets, 0),
    minutes: estimateMinutes(session.exercises),
    muscles: [...new Set(session.exercises.flatMap((e) => (e.exercise.muscleGroup ? [MUSCLE_GROUP_LABELS[e.exercise.muscleGroup]] : [])))].slice(0, 4),
  };
}

// Hero ------------------------------------------------------------------------

function HeroShell({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("relative isolate overflow-hidden rounded-3xl border bg-card p-5 sm:p-7", highlight && "bg-brand-glow dark:glow-brand")}>
      <span className="pointer-events-none absolute inset-0 -z-10 bg-tech-grid" aria-hidden />
      {children}
    </div>
  );
}

function StatusPill({ live = false, children }: { live?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
      <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-success dark:bg-brand" : "bg-foreground/40 dark:bg-brand/70")} aria-hidden />
      {children}
    </span>
  );
}

function WorkoutHero({ session, status, href, cta, live = false }: { session: SessionDetail; status: string; href: string; cta: string; live?: boolean }) {
  const stats = sessionStats(session);
  return (
    <HeroShell highlight>
      <div className="grid gap-5">
        <div className="grid gap-3">
          <StatusPill live={live}>{status}</StatusPill>
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{session.name}</h2>
          {stats.muscles.length > 0 && <p className="text-sm text-muted-foreground">{stats.muscles.join(" · ")}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip icon={Layers}>{stats.exercises} {stats.exercises === 1 ? "exercício" : "exercícios"}</Chip>
          {stats.sets > 0 && <Chip icon={Check}>{stats.sets} séries</Chip>}
          <Chip icon={Timer}>
            ≈ {stats.minutes} min<span className="sr-only"> (estimativa)</span>
          </Chip>
        </div>
        <Link href={href} className={buttonVariants({ size: "lg", className: "h-12 w-full rounded-full text-base sm:w-fit sm:px-8" })}>
          {live ? <ArrowRight aria-hidden /> : <Play className="fill-current" aria-hidden />}
          {cta}
        </Link>
      </div>
    </HeroShell>
  );
}

function RestHero({ next }: { next: { session: SessionDetail; inDays: number } | null }) {
  return (
    <HeroShell>
      <div className="grid gap-4">
        <StatusPill>Descanso</StatusPill>
        <div className="flex items-start gap-3">
          <MoonStar className="mt-1 size-7 shrink-0 text-muted-foreground" aria-hidden />
          <div className="grid gap-1">
            <h2 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Dia de descanso</h2>
            <p className="text-sm text-muted-foreground">Recuperar também faz parte do treino. Hidrate-se e durma bem.</p>
          </div>
        </div>
        {next && (
          <Link
            href={`/training/sessions/${next.session.id}`}
            className="flex items-center gap-3 rounded-2xl border bg-background/60 p-3 pr-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="grid min-w-0 flex-1">
              <span className="text-xs text-muted-foreground">
                Próximo treino · {next.inDays === 1 ? "amanhã" : WEEKDAYS[(weekdayToday() + next.inDays) % 7].long.toLowerCase()}
              </span>
              <span className="truncate font-semibold">{next.session.name}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </div>
    </HeroShell>
  );
}

// Week ------------------------------------------------------------------------

function dayDescription(day: WeekDay) {
  const name = WEEKDAYS[day.weekday].long;
  const state = day.done ? "treino concluído" : day.planned ? (day.isPast ? "treino planejado, não registrado" : "treino planejado") : "sem treino fixo";
  return `${name}${day.isToday ? " (hoje)" : ""}: ${state}`;
}

function WeekStrip({ days, done, planned }: { days: WeekDay[]; done: number; planned: number }) {
  return (
    <section aria-labelledby="week-title" className="grid gap-4 rounded-3xl border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-title" className="font-heading text-lg font-bold">Sua semana</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{done}</span>
          {planned > 0 ? ` de ${planned}` : ""} {(planned || done) === 1 ? "treino" : "treinos"}
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((day) => (
          <li key={day.date} className="grid justify-items-center gap-2">
            <span className={cn("text-[11px] font-semibold uppercase", day.isToday ? "text-foreground" : "text-muted-foreground")} aria-hidden>
              {WEEKDAYS[day.weekday].short.slice(0, 1)}
            </span>
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full border sm:size-10",
                day.done && "border-transparent bg-brand text-brand-foreground dark:shadow-[0_0_14px_-2px_var(--glow)]",
                !day.done && day.isToday && "border-2 border-foreground dark:border-brand",
                !day.done && !day.isToday && day.planned && "border-dashed border-foreground/40",
                !day.done && !day.planned && !day.isToday && "border-transparent bg-muted/60",
              )}
            >
              {day.done ? (
                <Check className="size-4" strokeWidth={3} aria-hidden />
              ) : day.planned ? (
                <span className="size-1.5 rounded-full bg-foreground/60" aria-hidden />
              ) : null}
              <span className="sr-only">{dayDescription(day)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><Check className="size-3" strokeWidth={3} />Concluído</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-foreground/60" />Planejado</span>
      </p>
    </section>
  );
}

// Shortcut tiles ---------------------------------------------------------------

function Tile({ href, icon: Icon, label, value, detail }: { href: string; icon: typeof Timer; label: string; value: string; detail?: string }) {
  return (
    <Link href={href} className="group grid gap-3 rounded-3xl border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
      <span className="flex items-center justify-between">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
      </span>
      <span className="grid">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="truncate font-heading text-lg font-bold tabular-nums">{value}</span>
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
    </Link>
  );
}

// Next booked session ----------------------------------------------------------

const sessionDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

function NextSession({ appointment, today }: { appointment: { startsAt: string; endsAt: string; location: string | null }; today: string }) {
  const date = localDate(appointment.startsAt);
  const day = date === today ? "Hoje" : date === addDays(today, 1) ? "Amanhã" : sessionDay.format(new Date(appointment.startsAt));
  return (
    <section aria-labelledby="next-session-title" className="flex items-center gap-4 rounded-3xl border bg-card p-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted" aria-hidden>
        <CalendarClock className="size-5" />
      </span>
      <div className="grid min-w-0">
        <h2 id="next-session-title" className="text-xs font-medium text-muted-foreground">Próxima sessão com seu personal</h2>
        <p className="font-heading text-lg font-bold first-letter:uppercase">
          {day} · <span className="tabular-nums">{localTime(appointment.startsAt)}–{localTime(appointment.endsAt)}</span>
        </p>
        {appointment.location && (
          <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {appointment.location}
          </p>
        )}
      </div>
    </section>
  );
}

// Page ------------------------------------------------------------------------

export async function StudentHome({ user }: { user: CurrentUser }) {
  const header = (subtitle: string, aside?: React.ReactNode) => {
    const date = longToday.format(new Date());
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{date}</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Olá, {firstName(user.fullName)}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
        </div>
        {aside}
      </div>
    );
  };

  if (!user.workspace) {
    return (
      <div className="grid gap-8">
        {header("Falta pouco para começar.")}
        <EmptyState icon={Users} title="Você ainda não tem um personal" description="Peça um link de convite ao seu personal para começar a acompanhar seus treinos." />
      </div>
    );
  }

  const [trainer, plans, openLog, waterGoal, waterToday, mealPlans, workoutDates, questionnaire, upcoming] = await Promise.all([
    getTrainer(user.workspace.id),
    getStudentPlans(user.id),
    getOpenLog(user.id),
    getCurrentGoal(user.id),
    getDailyTotals(user.id, 1),
    getStudentMealPlans(user.id),
    getCompletedWorkoutDates(user.id),
    getLatestQuestionnaire(user.id),
    listUpcomingForStudent(user.id, 1),
  ]);

  const today = weekdayToday();
  const todayIso = todayISO();
  const sessions = plans.flatMap((plan) => plan.sessions).filter((s) => s.exercises.length > 0);
  // Sessions without fixed days can be done any day, so they count as available today.
  const todays = sessions.filter((s) => s.weekdays.length === 0 || s.weekdays.includes(today));
  const openSession = openLog ? sessions.find((s) => s.id === openLog.sessionId) : undefined;
  const streak = weeklyStreak(workoutDates, todayIso);
  const week = weekSchedule(sessions, workoutDates, todayIso);
  const weekDone = week.filter((d) => d.done).length;
  const weekPlanned = week.filter((d) => d.planned).length;
  const water = waterToday[0].totalMl;
  const waterShare = waterGoal ? water / waterGoal : null;
  const planKcal = mealPlans[0]?.totals.kcal;
  const doneToday = workoutDates.includes(todayIso);

  const subtitle = openLog
    ? "Seu treino está em andamento."
    : doneToday
      ? "Treino de hoje concluído. Mandou bem!"
      : todays.length
        ? "Pronto para o treino de hoje?"
        : sessions.length
          ? "Dia de descanso no seu plano."
          : "Seu personal está preparando seu plano.";

  const streakBadge =
    streak > 0 ? (
      <div
        role="img"
        className="flex shrink-0 items-center gap-2 rounded-2xl border bg-card px-3 py-2"
        aria-label={`${streak} ${streak === 1 ? "semana" : "semanas"} seguidas com treino`}
      >
        <Flame className="size-5 dark:text-brand" aria-hidden />
        <span className="grid leading-tight" aria-hidden>
          <span className="text-lg font-extrabold tabular-nums">{streak}</span>
          <span className="text-[11px] text-muted-foreground">{streak === 1 ? "semana" : "semanas"}</span>
        </span>
      </div>
    ) : undefined;

  const [mainToday, ...otherToday] = todays;

  return (
    <div className="grid gap-6">
      {header(subtitle, streakBadge)}

      <section aria-label="Treino de hoje" className="grid gap-3">
        {openLog && openSession ? (
          <WorkoutHero session={openSession} status="Em andamento" href={`/training/log/${openLog.id}`} cta="Continuar treino" live />
        ) : mainToday ? (
          <WorkoutHero
            session={mainToday}
            status={doneToday ? "Concluído hoje · treinar de novo?" : mainToday.weekdays.length === 0 ? "Disponível hoje" : "Treino de hoje"}
            href={`/training/sessions/${mainToday.id}`}
            cta="Iniciar"
          />
        ) : sessions.length > 0 ? (
          <RestHero next={nextPlanned(sessions, today)} />
        ) : (
          <EmptyState icon={Layers} title="Seu plano ainda não foi publicado" description="Assim que seu personal publicar o plano de treino, ele aparece aqui." />
        )}
        {!openLog && otherToday.length > 0 && (
          <ul className="grid gap-2" aria-label="Também disponível hoje">
            {otherToday.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/training/sessions/${s.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-3 pr-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Play className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">≈ {estimateMinutes(s.exercises)} min</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {upcoming[0] && <NextSession appointment={upcoming[0]} today={todayIso} />}

      {!questionnaire && (
        <Link
          href="/anamnese"
          className="flex items-center gap-4 rounded-3xl border border-warning/30 bg-warning/10 p-4 outline-none hover:bg-warning/15 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
        >
          <HeartPulse className="size-6 shrink-0 text-warning" aria-hidden />
          <span className="grid min-w-0 flex-1">
            <span className="font-semibold">Responda a anamnese</span>
            <span className="text-sm text-muted-foreground">7 perguntas rápidas de saúde para seu personal montar treinos seguros.</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}

      {sessions.length > 0 && <WeekStrip days={week} done={weekDone} planned={weekPlanned} />}

      <section aria-labelledby="today-title" className="grid gap-5 rounded-3xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="today-title" className="font-heading text-lg font-bold">Progresso de hoje</h2>
          <Link href="/hydration" className="rounded-full px-2 py-1 text-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-brand">
            Hidratação
          </Link>
        </div>
        <div className="flex items-center gap-5">
          <ProgressRing
            value={waterShare}
            size={112}
            stroke={10}
            center={waterShare === null ? "—" : `${Math.round(waterShare * 100)}%`}
            caption={waterShare === null ? "sem meta" : "da meta"}
            label={waterGoal ? `Água hoje: ${formatVolume(water)} de ${formatVolume(waterGoal)}` : "Sem meta de água definida"}
            className="shrink-0"
          />
          <div className="grid min-w-0 gap-0.5">
            <span className="text-xs text-muted-foreground">Água hoje</span>
            <span className="font-heading text-2xl font-extrabold tabular-nums">{formatVolume(water)}</span>
            <span className="text-sm text-muted-foreground">
              {waterGoal ? (water >= waterGoal ? "Meta batida!" : `Faltam ${formatVolume(waterGoal - water)}`) : "Peça uma meta ao seu personal."}
            </span>
          </div>
        </div>
        <QuickAdd compact />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/meals" icon={Utensils} label="Dieta" value={planKcal ? `≈ ${formatKcal(planKcal)}` : "—"} detail={planKcal ? "por dia" : "Sem plano ainda"} />
        <Tile
          href="/progress"
          icon={TrendingUp}
          label="Evolução"
          value={`${workoutDates.length} ${workoutDates.length === 1 ? "treino" : "treinos"}`}
          detail="nos últimos 12 meses"
        />
      </div>

      <section aria-labelledby="ask-title" className="relative isolate grid gap-4 overflow-hidden rounded-3xl border bg-card p-5">
        <span className="pointer-events-none absolute inset-0 -z-10 bg-tech-grid" aria-hidden />
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground dark:bg-brand/15 dark:text-brand" aria-hidden>
            <Sparkles className="size-5" />
          </span>
          <div className="grid">
            <h2 id="ask-title" className="font-heading text-lg font-bold">Pergunte ao assistente</h2>
            <p className="text-sm text-muted-foreground">Dúvidas de execução e vídeos dos seus exercícios.</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-2">
          {SUGGESTIONS.student.slice(0, 3).map((q) => (
            <li key={q}>
              <Link
                href={`/assistant?q=${encodeURIComponent(q)}`}
                className="inline-flex min-h-11 items-center rounded-full border bg-background/70 px-4 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {q}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Seu personal" className="flex items-center gap-3 rounded-3xl border bg-card p-3 pr-4">
        <UserAvatar name={trainer?.fullName ?? user.workspace.name} src={avatarUrl(trainer?.avatarPath ?? null)} className="size-12 text-sm" />
        <div className="grid min-w-0 flex-1">
          <span className="text-xs text-muted-foreground">Seu personal</span>
          <span className="truncate font-semibold">{trainer?.fullName ?? "Seu personal"}</span>
        </div>
        {trainer?.whatsapp && (
          <a
            href={whatsappLink(trainer.whatsapp, `Olá, ${firstName(trainer.fullName)}! Aqui é ${firstName(user.fullName)}, do FitFlow Pro.`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", className: "shrink-0 rounded-full" })}
          >
            <MessageCircle aria-hidden />
            <span className="hidden sm:inline">WhatsApp</span>
            <span className="sr-only">Falar com {trainer.fullName} no WhatsApp (abre em nova aba)</span>
          </a>
        )}
      </section>
    </div>
  );
}
