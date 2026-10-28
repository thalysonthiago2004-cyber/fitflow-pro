import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { LogView } from "@/components/workouts/log-view";
import { WorkoutComments } from "@/components/workouts/workout-comments";
import { requireStaff } from "@/lib/auth/dal";
import { formatLongDate, todayISO } from "@/lib/format";
import { getLog } from "@/lib/workouts/queries";
import { getWeightOn } from "@/lib/progress/queries";

export const metadata: Metadata = { title: "Treino realizado" };

const UUID = /^[0-9a-f-]{36}$/i;

async function LogContent({ params }: Pick<PageProps<"/students/[studentId]/logs/[logId]">, "params">) {
  const { studentId, logId } = await params;
  if (!UUID.test(logId) || !UUID.test(studentId)) notFound();
  const user = await requireStaff();
  const log = await getLog(logId);
  if (!log || log.studentId !== studentId) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`${log.sessionName} — ${log.studentName}`}
        description={log.completedAt ? `Concluído em ${formatLongDate(log.completedAt)}` : "Treino em andamento"}
      />
      <LogView log={log} weightKg={log.completedAt ? await getWeightOn(log.studentId, todayISO(new Date(log.completedAt))) : null} />
      {log.completedAt && <WorkoutComments logId={log.id} viewerId={user.id} />}
    </div>
  );
}

export default function StudentLogPage({ params }: PageProps<"/students/[studentId]/logs/[logId]">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <BackLink href="/students">Alunos</BackLink>
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Carregando treino" />}>
        <LogContent params={params} />
      </Suspense>
    </div>
  );
}
