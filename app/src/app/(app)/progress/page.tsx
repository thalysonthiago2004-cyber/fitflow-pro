import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProgressView } from "@/components/progress/progress-view";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Evolução" };

async function Content() {
  const user = await requireUser();
  if (user.role !== "student") redirect("/students");
  if (!user.workspace) return <EmptyState icon={TrendingUp} title="Você ainda não tem um personal" description="A evolução fica disponível depois que você aceitar um convite." />;
  return <ProgressView studentId={user.id} viewerId={user.id} />;
}

export default function ProgressPage() {
  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader title="Evolução" description="Medidas, recordes e constância nos treinos." />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando evolução" />}>
        <Content />
      </Suspense>
    </div>
  );
}
