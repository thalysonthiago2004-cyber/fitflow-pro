import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Scale, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { getLatestMeasurements } from "@/lib/progress/queries";
import { listStudents } from "@/lib/students/queries";

export const metadata: Metadata = { title: "Avaliação" };

async function Content() {
  const user = await requireStaff();
  const [students, latest] = await Promise.all([listStudents(user.workspace.id), getLatestMeasurements(user.workspace.id)]);
  const active = students.filter((s) => s.status === "active");

  if (active.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="Nenhum aluno para avaliar ainda"
        description="A avaliação corporal é feita para cada aluno. Convide o primeiro aluno e, depois que ele aceitar, registre as medidas ou os valores da balança de bioimpedância por aqui."
        action={
          <Link href="/students/invite" className={buttonVariants()}>
            <UserPlus aria-hidden />
            Convidar aluno
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-3">
      {active.map((student) => {
        const last = latest.get(student.userId);
        return (
          <li key={student.userId}>
            <Link
              href={`/students/${student.userId}/progress#avaliacao`}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="truncate font-medium">{student.fullName}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {last ? `Última medição em ${formatDate(last.measuredOn)}` : "Sem medições"}
                  {last?.source === "bioimpedance" && <Badge variant="secondary">Bioimpedância</Badge>}
                </span>
              </div>
              <span className="hidden text-sm font-medium sm:inline">Abrir avaliação</span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function AssessmentsPage() {
  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader
        title="Avaliação corporal"
        description="Estimativas rápidas pelas medidas (IMC, % de gordura, massa magra, TMB) e registro dos valores da balança de bioimpedância de cada aluno."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" aria-label="Carregando alunos" />}>
        <Content />
      </Suspense>
    </div>
  );
}
