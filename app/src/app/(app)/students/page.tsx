import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, MailPlus, Scale, Search, UserPlus, Users } from "lucide-react";
import { ChipRow } from "@/components/chip-row";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/dal";
import { addDays, formatDate, todayISO } from "@/lib/format";
import { getWorkspaceCompletions } from "@/lib/progress/queries";
import { listAppointments } from "@/lib/schedule/queries";
import { localTime } from "@/lib/schedule/time";
import {
  ROSTER_FILTERS, ROSTER_FILTER_LABELS, ROSTER_SORTS, ROSTER_SORT_LABELS, buildRoster, daysAgo, filterRoster, isInactive, parseRosterFilter, parseRosterSort, sortRoster,
} from "@/lib/students/roster";
import { listPlans } from "@/lib/workouts/queries";
import { listPendingInvitations, listStudents } from "@/lib/students/queries";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { InvitationActions } from "./invitation-actions";

export const metadata: Metadata = { title: "Alunos" };

const sessionDay = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const sessionLabel = (iso: string) => `${sessionDay.format(new Date(iso)).replace(".", "")} · ${localTime(iso)}`;

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const text = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold" aria-hidden>
      {text}
    </span>
  );
}

type View = "active" | "archived" | "invites";
const VIEWS: { key: View; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "archived", label: "Arquivados" },
  { key: "invites", label: "Convites pendentes" },
];

async function StudentsContent({ searchParams }: Pick<PageProps<"/students">, "searchParams">) {
  const params = await searchParams;
  const view: View = VIEWS.some((v) => v.key === params.view) ? (params.view as View) : "active";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";

  const filter = parseRosterFilter(params.filtro);
  const sort = parseRosterSort(params.ordem);
  const today = todayISO();

  const user = await requireStaff();
  const [students, invitations, activePlans, completions, agenda] = await Promise.all([
    listStudents(user.workspace.id),
    listPendingInvitations(user.workspace.id),
    listPlans({ workspaceId: user.workspace.id, statuses: ["active"] }),
    getWorkspaceCompletions(user.workspace.id, addDays(today, -365)),
    listAppointments(user.workspace.id, today, addDays(today, 60)),
  ]);
  const now = new Date();
  const roster = buildRoster({
    students,
    activePlans,
    completions,
    upcoming: agenda.filter((a) => a.status === "scheduled" && new Date(a.endsAt) > now),
    today,
  });

  const counts: Record<View, number> = {
    active: students.filter((s) => s.status === "active").length,
    archived: students.filter((s) => s.status === "archived").length,
    invites: invitations.length,
  };

  const needle = normalize(query);
  const matches = (...fields: string[]) => !needle || fields.some((f) => normalize(f).includes(needle));
  const inView = roster.filter((s) => s.status === view && matches(s.fullName, s.email));
  const visibleStudents = sortRoster(view === "active" ? filterRoster(inView, filter, today) : inView, sort);
  const lastLabel = (date: string | null) => (date ? daysAgo(date, today)! : "Nunca treinou");
  const keep = (extra: Record<string, string>) => ({
    pathname: "/students",
    query: { view, ...(query ? { q: query } : {}), ...(filter !== "all" ? { filtro: filter } : {}), ...(sort !== "name" ? { ordem: sort } : {}), ...extra },
  });
  const visibleInvites = invitations.filter((i) => matches(i.fullName, i.email));

  return (
    <div className="grid gap-6">
      <nav aria-label="Filtrar alunos" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-xl bg-muted p-1">
          {VIEWS.map(({ key, label }) => (
            <li key={key}>
              <Link
                href={{ pathname: "/students", query: { view: key, ...(query ? { q: query } : {}) } }}
                aria-current={view === key ? "page" : undefined}
                className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
              >
                {label}
                <span className="rounded-full bg-background px-1.5 text-xs tabular-nums">{counts[key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form role="search" className="relative max-w-md" action="/students">
        <input type="hidden" name="view" value={view} />
        <label htmlFor="student-search" className="sr-only">
          Buscar por nome ou e-mail
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="student-search" name="q" type="search" defaultValue={query} placeholder="Buscar por nome ou e-mail" className="pl-9" />
        {filter !== "all" && <input type="hidden" name="filtro" value={filter} />}
        {sort !== "name" && <input type="hidden" name="ordem" value={sort} />}
      </form>

      {view !== "invites" && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {view === "active" ? (
            <ChipRow label="Filtros rápidos">
              {ROSTER_FILTERS.map((key) => {
                const n = filterRoster(inView, key, today).length;
                return (
                  <Link
                    key={key}
                    href={keep({ filtro: key })}
                    aria-current={filter === key ? "page" : undefined}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:border-transparent aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                  >
                    {ROSTER_FILTER_LABELS[key]}
                    <span className="tabular-nums opacity-70">{n}</span>
                  </Link>
                );
              })}
            </ChipRow>
          ) : (
            <span />
          )}
          <ChipRow label="Ordenar alunos" className="text-sm">
            <span className="mr-1 text-muted-foreground">Ordenar:</span>
            {ROSTER_SORTS.map((key) => (
              <Link
                key={key}
                href={keep({ ordem: key })}
                aria-current={sort === key ? "page" : undefined}
                className="inline-flex h-9 items-center rounded-full px-3 font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
              >
                {ROSTER_SORT_LABELS[key]}
              </Link>
            ))}
          </ChipRow>
        </div>
      )}

      {view === "invites" ? (
        visibleInvites.length === 0 ? (
          <EmptyState
            icon={MailPlus}
            title={query ? "Nenhum convite encontrado" : "Nenhum convite pendente"}
            description={query ? "Tente buscar por outro nome ou e-mail." : "Convites aceitos viram alunos ativos automaticamente."}
          />
        ) : (
          <ul className="grid gap-3">
            {visibleInvites.map((invite) => (
              <li key={invite.id} className="flex flex-col gap-3 surface-row p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid min-w-0 gap-0.5">
                  <p className="truncate font-medium">{invite.fullName}</p>
                  <p className="truncate text-sm text-muted-foreground">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">Expira em {formatDate(invite.expiresAt)}</p>
                </div>
                <InvitationActions invitationId={invite.id} studentName={invite.fullName} />
              </li>
            ))}
          </ul>
        )
      ) : visibleStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query || filter !== "all" ? "Nenhum aluno encontrado" : view === "active" ? "Nenhum aluno ativo" : "Nenhum aluno arquivado"}
          description={
            query
              ? "Tente buscar por outro nome ou e-mail."
              : filter !== "all"
                ? "Nenhum aluno nesse filtro. Bom sinal!"
                : view === "active"
                  ? "Convide seu primeiro aluno para começar a acompanhar os treinos."
                  : "Alunos arquivados aparecem aqui e podem ser reativados a qualquer momento."
          }
          action={
            view === "active" && !query && filter === "all" ? (
              <Link href="/students/invite" className={buttonVariants()}>
                <UserPlus aria-hidden />
                Convidar aluno
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="-mb-3 text-sm text-muted-foreground" aria-live="polite">
            {visibleStudents.length} {visibleStudents.length === 1 ? "aluno" : "alunos"}
            {filter !== "all" && view === "active" && ` · ${ROSTER_FILTER_LABELS[filter].toLowerCase()}`}
          </p>
          <ul className="grid gap-2 md:hidden">
            {visibleStudents.map((student) => (
              <li key={student.userId}>
                <Link
                  href={`/students/${student.userId}`}
                  className="flex items-center gap-3 surface-row p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Initials name={student.fullName} />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="truncate font-semibold">{student.fullName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {student.activePlan ? student.activePlan.name : <span className="font-medium text-warning">Sem plano ativo</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Último treino: {lastLabel(student.lastWorkout)}
                      {student.nextSession && ` · Próxima sessão ${sessionLabel(student.nextSession.startsAt)}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Aluno</TableHead>
                  <TableHead>Plano ativo</TableHead>
                  <TableHead>Último treino</TableHead>
                  <TableHead className="text-right">Treinos (30 dias)</TableHead>
                  <TableHead className="pr-4">Próxima sessão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStudents.map((student) => (
                  <TableRow key={student.userId}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Initials name={student.fullName} />
                        <div className="grid min-w-0">
                          <Link href={`/students/${student.userId}`} className="truncate rounded-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                            {student.fullName}
                          </Link>
                          <span className="truncate text-xs text-muted-foreground">{student.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56">
                      {student.activePlan ? (
                        <Link href={`/workouts/${student.activePlan.id}`} className="block truncate rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                          {student.activePlan.name}
                        </Link>
                      ) : (
                        <StatusBadge tone="warning">Sem plano ativo</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className={cn("tabular-nums", isInactive(student, today) && "text-warning")}>
                      {lastLabel(student.lastWorkout)}
                      {student.lastWorkout && <span className="block text-xs text-muted-foreground">{formatDate(student.lastWorkout)}</span>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{student.workouts30}</TableCell>
                    <TableCell className="pr-4 tabular-nums">
                      {student.nextSession ? sessionLabel(student.nextSession.startsAt) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function StudentsSkeleton() {
  return (
    <div role="status" className="grid gap-6" aria-busy="true" aria-label="Carregando alunos">
      <div className="h-12 w-80 max-w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-11 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function StudentsPage({ searchParams }: PageProps<"/students">) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Alunos"
        description="Convide, acompanhe e organize seus alunos."
        actions={
          <>
            <Link href="/assessments" className={buttonVariants({ variant: "outline" })}>
              <Scale aria-hidden />
              Avaliação
            </Link>
            <Link href="/students/invite" className={buttonVariants()}>
              <UserPlus aria-hidden />
              Convidar aluno
            </Link>
          </>
        }
      />
      <Suspense fallback={<StudentsSkeleton />}>
        <StudentsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
