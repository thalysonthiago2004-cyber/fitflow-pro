import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/dal";
import { createExercise } from "../actions";
import { ExerciseForm } from "../exercise-form";

export const metadata: Metadata = { title: "Novo exercício" };

async function AuthorizedForm() {
  await requireStaff();
  return <ExerciseForm action={createExercise} submitLabel="Criar exercício" />;
}

export default function NewExercisePage() {
  return (
    <div className="grid max-w-2xl gap-8">
      <BackLink href="/exercises">Exercícios</BackLink>
      <PageHeader title="Novo exercício" description="Fica disponível só para o seu espaço de trabalho." />
      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardContent>
          <Suspense fallback={<div className="h-96" aria-hidden />}>
            <AuthorizedForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
