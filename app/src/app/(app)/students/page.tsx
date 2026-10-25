import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, MailPlus, Scale, Search, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { listPendingInvitations, listStudents } from "@/lib/students/queries";
import { STUDENT_STATUS_LABELS } from "@/lib/students/schemas";
import { cn } from "@/lib/utils";
import { InvitationActions } from "./invitation-actions";

export const metadata: Metadata = { title: "Alunos" };

type View = "active" | "archived" | "invites";
const VIEWS: { key: View; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "archived", label: "Arquivados" },
  { key: "invites", label: "Convites pendentes" },
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

async function StudentsContent({ searchParams }: Pick<PageProps<"/students">, "searchParams">) {
  const params = await searchParams;
  const view: View = VIEWS.some((v) => v.key === params.view) ? (params.view as View) : "active";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";

  const user = await requireStaff();
  const [students, invitations] = await Promise.all([
    listStudents(user.workspace.id),
    listPendingInvitations(user.workspace.id),
  ]);

  const counts: Record<View, number> = {
    active: students.filter((s) => s.status === "active").length,
    archived: students.filter((s) => s.status === "archived").length,
    invites: invitations.length,
  };

  const needle = normalize(query);
  const matches = (...fields: string[]) => !needle || fields.some((f) => normalize(f).includes(needle));
  const visibleStudents = students.filter((s) => s.status === view && matches(s.fullName, s.email));
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
      </form>

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
              <li key={invite.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
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
          title={query ? "Nenhum aluno encontrado" : view === "active" ? "Nenhum aluno ativo" : "Nenhum aluno arquivado"}
          description={
            query
              ? "Tente buscar por outro nome ou e-mail."
              : view === "active"
                ? "Convide seu primeiro aluno para começar a acompanhar os treinos."
                : "Alunos arquivados aparecem aqui e podem ser reativados a qualquer momento."
          }
          action={
            view === "active" && !query ? (
              <Link href="/students/invite" className={buttonVariants()}>
                <UserPlus aria-hidden />
                Convidar aluno
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {visibleStudents.map((student) => (
              <li key={student.userId}>
                <Link
                  href={`/students/${student.userId}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="truncate font-medium">{student.fullName}</p>
                    <p className="truncate text-sm text-muted-foreground">{student.email}</p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStudents.map((student) => (
                  <TableRow key={student.userId}>
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/students/${student.userId}`} className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                        {student.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{student.email}</TableCell>
                    <TableCell className={cn("max-w-56 truncate", !student.goal && "text-muted-foreground")}>
                      {student.goal ?? "Não definido"}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDate(student.joinedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={student.status === "active" ? "success" : "neutral"}>
                        {STUDENT_STATUS_LABELS[student.status]}
                      </StatusBadge>
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
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando alunos">
      <div className="h-12 w-80 max-w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-11 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
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
