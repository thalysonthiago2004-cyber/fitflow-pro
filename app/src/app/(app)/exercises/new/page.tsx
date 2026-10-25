import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
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
      <Link href="/exercises" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Exercícios
      </Link>
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
