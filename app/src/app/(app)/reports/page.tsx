import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck, Download, Dumbbell, Target, UserPlus, Users } from "lucide-react";
import { KpiCard } from "@/components/brand-ui/kpi-card";
import { ChipRow } from "@/components/chip-row";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WeeklyWorkoutsChart } from "@/components/progress/weekly-workouts-chart";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/lib/auth/dal";
import { formatDate, formatLongDate, formatNumber, todayISO } from "@/lib/format";
import { MAX_RANGE_DAYS, REPORT_PRESETS, type ReportRange, type SortKey, type StudentRow, STUDENT_STATUS_TEXT, parseRange, parseSort, sortRows } from "@/lib/reports/build";
import { loadReport } from "@/lib/reports/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios" };

const PRESET_LABELS: Record<number, string> = { 7: "7 dias", 30: "30 dias", 90: "90 dias", 365: "12 meses" };
const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

function query(range: ReportRange, sort: SortKey, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(range.preset ? { periodo: String(range.preset) } : { de: range.from, ate: range.to });
  if (sort !== "workouts") params.set("ordem", sort);
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return params.toString();
}

const COLUMNS: { key: SortKey | null; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Aluno" },
  { key: "workouts", label: "Treinos", numeric: true },
  { key: null, label: "Por semana", numeric: true },
  { key: "last", label: "Último treino" },
  { key: null, label: "Sessões realizadas", numeric: true },
  { key: null, label: "Faltas", numeric: true },
  { key: "attendance", label: "Presença", numeric: true },
];

function StudentTable({ rows, range, sort }: { rows: StudentRow[]; range: ReportRange; sort: SortKey }) {
  return (
    <>
      {/* Desktop and tablet: a sortable table. */}
      <div className="hidden overflow-x-auto surface md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Atividade por aluno no período. Ordenado por {COLUMNS.find((c) => c.key === sort)?.label.toLowerCase()}.</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  aria-sort={c.key === sort ? (sort === "name" ? "ascending" : "descending") : undefined}
                  className={cn("px-4 py-3 font-medium whitespace-nowrap", c.numeric && "text-right")}
                >
                  {c.key ? (
                    <Link
                      href={`/reports?${query(range, c.key)}`}
                      className={cn("rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50", c.key === sort && "font-semibold text-foreground")}
                    >
                      {c.label}
                      {c.key === sort && <span aria-hidden>{sort === "name" ? " ↑" : " ↓"}</span>}
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-b last:border-0 hover:bg-accent/50">
                <td className="px-4 py-3">
                  <Link href={`/students/${r.studentId}`} className="rounded-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                    {r.name}
                  </Link>
                  {r.status === "archived" && <span className="ml-2 text-xs text-muted-foreground">(arquivado)</span>}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.workouts}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(r.perWeek, 1)}</td>
                <td className="px-4 py-3 tabular-nums">{r.lastWorkout ? formatDate(r.lastWorkout) : <span className="text-muted-foreground">Nenhum</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.sessionsDone}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.noShows}</td>
                <td className="px-4 py-3 text-right tabular-nums">{pct(r.attendance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per student, same order. */}
      <ul className="grid gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.studentId}>
            <Link href={`/students/${r.studentId}`} className="grid gap-3 surface-row p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{r.name}</span>
                {r.status === "archived" && <StatusBadge tone="neutral">{STUDENT_STATUS_TEXT.archived}</StatusBadge>}
              </span>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Treinos</dt>
                  <dd className="text-base font-bold tabular-nums">{r.workouts}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Por semana</dt>
                  <dd className="text-base font-bold tabular-nums">{formatNumber(r.perWeek, 1)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Presença</dt>
                  <dd className="text-base font-bold tabular-nums">{pct(r.attendance)}</dd>
                </div>
              </dl>
              <span className="text-xs text-muted-foreground">
                Último treino: {r.lastWorkout ? formatDate(r.lastWorkout) : "nenhum no período"} · {r.sessionsDone} {r.sessionsDone === 1 ? "sessão realizada" : "sessões realizadas"} · {r.noShows}{" "}
                {r.noShows === 1 ? "falta" : "faltas"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

async function ReportsContent({ searchParams }: Pick<PageProps<"/reports">, "searchParams">) {
  const user = await requireStaff();
  const params = await searchParams;
  const today = todayISO();
  const range = parseRange(params, today);
  const sort = parseSort(params.ordem);
  const { summary, rows, weeks, hasStudents } = await loadReport(user.workspace.id, range);
  const exportHref = `/reports/export?${query(range, sort)}`;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Relatórios"
        description="Atividade dos seus alunos em um período, a partir dos treinos registrados e da agenda."
        actions={
          hasStudents ? (
            <a href={exportHref} download className={buttonVariants({ variant: "secondary", size: "lg" })}>
              <Download aria-hidden />
              Exportar CSV
            </a>
          ) : undefined
        }
      />

      <section aria-label="Período" className="grid gap-3 surface p-4">
        <ChipRow label="Períodos prontos">
          {REPORT_PRESETS.map((p) => (
            <Link
              key={p}
              href={`/reports?${query({ ...range, preset: p }, sort)}`}
              aria-current={range.preset === p ? "page" : undefined}
              className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:border-transparent aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {PRESET_LABELS[p]}
            </Link>
          ))}
        </ChipRow>
        <form action="/reports" className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="report-from">De</Label>
            <Input id="report-from" name="de" type="date" max={today} defaultValue={range.from} required className="w-44" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-to">Até</Label>
            <Input id="report-to" name="ate" type="date" max={today} defaultValue={range.to} required className="w-44" />
          </div>
          {sort !== "workouts" && <input type="hidden" name="ordem" value={sort} />}
          <Button type="submit" variant="outline">Aplicar</Button>
          <p className="basis-full text-xs text-muted-foreground">
            {formatLongDate(range.from)} a {formatLongDate(range.to)} · {range.days} {range.days === 1 ? "dia" : "dias"}. Períodos de até {MAX_RANGE_DAYS} dias.
          </p>
        </form>
      </section>

      {!hasStudents ? (
        <EmptyState
          icon={Users}
          title="Sem alunos para relatar"
          description="Os relatórios aparecem quando você tiver alunos registrando treinos e sessões na agenda."
          action={<Link href="/students/invite" className={buttonVariants({ variant: "secondary" })}>Convidar aluno</Link>}
        />
      ) : (
        <>
          <section aria-labelledby="summary-title" className="grid gap-3">
            <h2 id="summary-title" className="font-heading text-lg font-bold">Resumo do período</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={Dumbbell} label="Treinos concluídos" value={formatNumber(summary.workouts, 0)} detail={`${summary.studentsTrained} ${summary.studentsTrained === 1 ? "aluno treinou" : "alunos treinaram"}`} highlight />
              <KpiCard icon={Target} label="Adesão" value={pct(summary.adherence)} detail={`de ${summary.activeStudents} ${summary.activeStudents === 1 ? "aluno ativo" : "alunos ativos"}`} />
              <KpiCard
                icon={CalendarCheck}
                label="Presença nas sessões"
                value={pct(summary.attendance)}
                detail={`${summary.sessionsDone} realizadas · ${summary.noShows} ${summary.noShows === 1 ? "falta" : "faltas"} · ${summary.cancelled} ${summary.cancelled === 1 ? "cancelada" : "canceladas"}`}
              />
              <KpiCard icon={UserPlus} label="Novos alunos" value={formatNumber(summary.newStudents, 0)} detail="entraram no período" />
            </div>
          </section>

          <section aria-label="Treinos por semana" className="surface p-5">
            <WeeklyWorkoutsChart weeks={weeks} period="no período" />
          </section>

          <section aria-labelledby="students-title" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="students-title" className="font-heading text-lg font-bold">Por aluno</h2>
              <p className="text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? "aluno" : "alunos"}</p>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum aluno ativo nem atividade no período.</p>
            ) : (
              <>
                <ChipRow label="Ordenar" className="md:hidden">
                  {(["workouts", "last", "attendance", "name"] as const).map((key) => (
                    <Link
                      key={key}
                      href={`/reports?${query(range, key)}`}
                      aria-current={key === sort ? "page" : undefined}
                      className="inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:border-transparent aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                    >
                      {{ workouts: "Mais treinos", last: "Treinou por último", attendance: "Presença", name: "Nome" }[key]}
                    </Link>
                  ))}
                </ChipRow>
                <StudentTable rows={sortRows(rows, sort)} range={range} sort={sort} />
              </>
            )}
          </section>

          <details className="surface p-4 text-sm">
            <summary className="cursor-pointer font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Como os números são calculados</summary>
            <dl className="mt-3 grid gap-3 text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Treinos concluídos</dt>
                <dd>Treinos que o aluno registrou e concluiu no app, pela data de conclusão (horário de Brasília).</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Adesão</dt>
                <dd>Alunos ativos hoje que concluíram ao menos um treino no período, dividido pelo total de alunos ativos.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Por semana</dt>
                <dd>Treinos concluídos divididos pelo número de semanas do período.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Presença nas sessões</dt>
                <dd>Sessões da agenda marcadas como realizadas, dividido por realizadas mais faltas. Sessões canceladas ou ainda não marcadas não entram na conta.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Faturamento</dt>
                <dd>Ainda não aparece: o app não registra pagamentos. Entra quando a cobrança for ativada.</dd>
              </div>
            </dl>
          </details>
        </>
      )}
    </div>
  );
}

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense fallback={<div role="status" aria-label="Carregando relatórios" className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}
