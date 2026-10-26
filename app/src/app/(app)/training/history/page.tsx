import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight, History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatDuration } from "@/lib/format";
import { listLogs } from "@/lib/workouts/queries";
import { requireStudent } from "../require-student";

export const metadata: Metadata = { title: "Histórico de treinos" };

async function HistoryContent() {
  const user = await requireStudent();
  const logs = await listLogs({ studentId: user.id, completedOnly: true, limit: 100 });

  if (logs.length === 0) {
    return <EmptyState icon={History} title="Nenhum treino concluído" description="Conclua um treino para começar seu histórico." />;
  }

  return (
    <ul className="grid gap-2">
      {logs.map((log) => (
        <li key={log.id}>
          <Link href={`/training/log/${log.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
            <div className="grid flex-1 gap-0.5">
              <span className="font-medium">{log.sessionName}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatDate(log.completedAt!)} · {formatDuration(log.startedAt, log.completedAt!)}
              </span>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function HistoryPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/training" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Meus treinos
      </Link>
      <PageHeader title="Histórico de treinos" description="Seus últimos 100 treinos concluídos." />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando histórico" />}>
        <HistoryContent />
      </Suspense>
    </div>
  );
}
