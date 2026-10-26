import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LogView } from "@/components/workouts/log-view";
import { WorkoutComments } from "@/components/workouts/workout-comments";
import { formatLongDate, todayISO } from "@/lib/format";
import { getLog } from "@/lib/workouts/queries";
import { getWeightOn } from "@/lib/progress/queries";
import { requireStudent } from "../../require-student";
import { WorkoutLogger } from "./workout-logger";

export const metadata: Metadata = { title: "Treino" };

const UUID = /^[0-9a-f-]{36}$/i;

async function LogContent({ params }: Pick<PageProps<"/training/log/[logId]">, "params">) {
  const { logId } = await params;
  if (!UUID.test(logId)) notFound();
  const user = await requireStudent();
  const log = await getLog(logId);
  if (!log || log.studentId !== user.id) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader
        title={log.sessionName}
        description={log.completedAt ? `Concluído em ${formatLongDate(log.completedAt)}` : "Registre as séries conforme for treinando."}
      />
      {log.completedAt ? (
        <>
          <LogView log={log} weightKg={await getWeightOn(log.studentId, todayISO(new Date(log.completedAt)))} />
          <WorkoutComments logId={log.id} viewerId={user.id} />
        </>
      ) : (
        <WorkoutLogger log={log} />
      )}
    </div>
  );
}

export default function TrainingLogPage({ params }: PageProps<"/training/log/[logId]">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/training" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Meus treinos
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando treino" />}>
        <LogContent params={params} />
      </Suspense>
    </div>
  );
}
