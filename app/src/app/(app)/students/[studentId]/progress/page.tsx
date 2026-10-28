import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { ProgressView } from "@/components/progress/progress-view";
import { requireStaff } from "@/lib/auth/dal";
import { getStudent } from "@/lib/students/queries";

export const metadata: Metadata = { title: "Evolução do aluno" };

async function Content({ params }: Pick<PageProps<"/students/[studentId]/progress">, "params">) {
  const { studentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) notFound();
  const user = await requireStaff();
  const student = await getStudent(user.workspace.id, studentId);
  if (!student) notFound();
  return (
    <div className="grid gap-8">
      <PageHeader title={`Evolução — ${student.fullName}`} description="Medidas registradas pelo aluno ou por você, recordes calculados a partir dos treinos." />
      <ProgressView studentId={studentId} viewerId={user.id} />
    </div>
  );
}

export default function StudentProgressPage({ params }: PageProps<"/students/[studentId]/progress">) {
  return (
    <div className="grid max-w-4xl gap-6">
      <BackLink href="/students">Alunos</BackLink>
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Carregando evolução" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}
