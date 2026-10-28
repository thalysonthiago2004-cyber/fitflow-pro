import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { addDays, isCalendarDate, todayISO } from "@/lib/format";
import { type Appointment, listAppointments } from "@/lib/schedule/queries";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/schedule/schemas";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { formatMinutes, localDate, localTime, minutesBetween, weekDates } from "@/lib/schedule/time";
import { listStudents } from "@/lib/students/queries";
import { WEEKDAYS } from "@/lib/workouts/labels";
import { cn } from "@/lib/utils";
import { AppointmentDialog } from "./appointment-dialog";

export const metadata: Metadata = { title: "Agenda" };

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (date: string) => dayMonth.format(new Date(`${date}T12:00:00Z`)).replace(".", "");

const STATUS_DOTS: Record<AppointmentStatus, string> = { scheduled: "bg-info", completed: "bg-success", cancelled: "bg-muted-foreground", no_show: "bg-warning" };

function weekParam(value: unknown): string {
  return isCalendarDate(value) ? value : todayISO();
}

function AppointmentCard({ appointment, students }: { appointment: Appointment; students: { id: string; name: string }[] }) {
  const start = localTime(appointment.startsAt);
  const end = localTime(appointment.endsAt);
  const inactive = appointment.status === "cancelled" || appointment.status === "no_show";
  return (
    <AppointmentDialog
      students={students}
      appointment={appointment}
      defaultDate={localDate(appointment.startsAt)}
      trigger={
        <button
          type="button"
          aria-label={`${start} às ${end}, ${appointment.studentName}, ${APPOINTMENT_STATUS_LABELS[appointment.status]}`}
          className={cn(
            "grid w-full gap-1.5 rounded-xl border bg-card p-3 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
            appointment.status === "scheduled" && "border-l-4 border-l-brand",
            inactive && "opacity-70",
          )}
        >
          <span className={cn("text-sm font-bold tabular-nums", appointment.status === "cancelled" && "line-through")}>
            {start}–{end}
          </span>
          <span className="truncate text-sm font-semibold">{appointment.studentName}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", STATUS_DOTS[appointment.status])} aria-hidden />
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </span>
          {appointment.location && (
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" aria-hidden />
              {appointment.location}
            </span>
          )}
        </button>
      }
    />
  );
}

async function ScheduleContent({ searchParams }: Pick<PageProps<"/schedule">, "searchParams">) {
  const user = await requireStaff();
  const { semana } = await searchParams;
  const today = todayISO();
  const days = weekDates(weekParam(semana));
  const [appointments, students] = await Promise.all([listAppointments(user.workspace.id, days[0], days[6]), listStudents(user.workspace.id)]);
  const options = students.filter((s) => s.status === "active").map((s) => ({ id: s.userId, name: s.fullName }));
  const byDay = new Map(days.map((d) => [d, appointments.filter((a) => localDate(a.startsAt) === d)]));
  const booked = appointments.filter((a) => a.status === "scheduled" || a.status === "completed");
  const minutes = booked.reduce((sum, a) => sum + minutesBetween(a.startsAt, a.endsAt), 0);
  const isThisWeek = days.includes(today);
  const newDate = isThisWeek ? today : days[0];

  const newButton = (
    <AppointmentDialog
      students={options}
      defaultDate={newDate}
      trigger={
        <Button size="lg" disabled={options.length === 0}>
          <Plus aria-hidden />
          Nova sessão
        </Button>
      }
    />
  );

  return (
    <div className="grid gap-6">
      <PageHeader title="Agenda" description="Sessões com seus alunos, no horário de Brasília." actions={newButton} />

      {options.length === 0 && (
        <EmptyState
          icon={UserPlus}
          title="Convide um aluno para agendar"
          description="As sessões são marcadas com alunos ativos do seu espaço."
          action={<Link href="/students/invite" className={buttonVariants({ variant: "secondary" })}>Convidar aluno</Link>}
        />
      )}

      <nav aria-label="Semana" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={`/schedule?semana=${addDays(days[0], -7)}`} className={buttonVariants({ variant: "outline", size: "icon", className: "size-11" })}>
            <ChevronLeft aria-hidden />
            <span className="sr-only">Semana anterior</span>
          </Link>
          <Link href={`/schedule?semana=${addDays(days[0], 7)}`} className={buttonVariants({ variant: "outline", size: "icon", className: "size-11" })}>
            <ChevronRight aria-hidden />
            <span className="sr-only">Próxima semana</span>
          </Link>
          <h2 className="ml-2 font-heading text-lg font-bold tabular-nums" aria-live="polite">
            {fmt(days[0])} – {fmt(days[6])}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {booked.length} {booked.length === 1 ? "sessão" : "sessões"}
            {minutes > 0 && ` · ${formatMinutes(minutes)}`}
          </p>
          {!isThisWeek && (
            <Link href="/schedule" className={buttonVariants({ variant: "secondary" })}>
              Hoje
            </Link>
          )}
        </div>
      </nav>

      <ol className="grid gap-3 lg:grid-cols-7 lg:gap-2">
        {days.map((date, i) => {
          const list = byDay.get(date) ?? [];
          const isToday = date === today;
          const weekday = WEEKDAYS[(i + 1) % 7];
          return (
            <li key={date} aria-label={`${weekday.long}, ${fmt(date)}${isToday ? " (hoje)" : ""}`} className="grid content-start gap-2 lg:min-h-48">
              <div
                className={cn(
                  "flex items-baseline gap-2 border-b pb-1.5 lg:flex-col lg:items-start lg:gap-0",
                  isToday && "border-b-2 border-foreground dark:border-brand",
                )}
              >
                <span className={cn("text-xs font-semibold uppercase", isToday ? "text-foreground dark:text-brand" : "text-muted-foreground")}>
                  {weekday.short}
                  {isToday && " · hoje"}
                </span>
                <span className="font-heading text-base font-bold tabular-nums">{fmt(date)}</span>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground lg:py-2">Livre</p>
              ) : (
                <ul className="grid gap-2">
                  {list.map((a) => (
                    <li key={a.id}>
                      <AppointmentCard appointment={a} students={options} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {appointments.length === 0 && options.length > 0 && (
        <EmptyState icon={CalendarDays} title="Semana livre" description="Nenhuma sessão nesta semana. Use “Nova sessão” para agendar um horário com um aluno." />
      )}
    </div>
  );
}

export default function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  return (
    <Suspense fallback={<div role="status" aria-label="Carregando agenda" className="h-96 animate-pulse rounded-3xl bg-muted" />}>
      <ScheduleContent searchParams={searchParams} />
    </Suspense>
  );
}
