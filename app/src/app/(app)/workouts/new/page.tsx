import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/dal";
import { listStudents } from "@/lib/students/queries";
import { NewPlanForm } from "./new-plan-form";

export const metadata: Metadata = { title: "Novo plano" };

async function NewPlanContent({ searchParams }: Pick<PageProps<"/workouts/new">, "searchParams">) {
  const { student } = await searchParams;
  const user = await requireStaff();
  const students = (await listStudents(user.workspace.id)).filter((s) => s.status === "active");

  if (students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Você ainda não tem alunos ativos"
        description="Convide um aluno para criar o primeiro plano de treino."
        action={<Link href="/students/invite" className={buttonVariants()}>Convidar aluno</Link>}
      />
    );
  }

  return (
    <Card className="py-6 [--card-spacing:--spacing(6)]">
      <CardContent>
        <NewPlanForm
          students={students.map((s) => ({ value: s.userId, label: s.fullName }))}
          defaultStudentId={typeof student === "string" ? student : undefined}
        />
      </CardContent>
    </Card>
  );
}

export default function NewPlanPage({ searchParams }: PageProps<"/workouts/new">) {
  return (
    <div className="grid max-w-2xl gap-8">
      <BackLink href="/workouts">Planos de treino</BackLink>
      <PageHeader title="Novo plano de treino" description="Escolha o aluno e dê um nome ao plano. Depois você monta os treinos." />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Carregando" />}>
        <NewPlanContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
