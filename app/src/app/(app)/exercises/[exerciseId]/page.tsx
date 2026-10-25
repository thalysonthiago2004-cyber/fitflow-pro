import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExerciseDemo } from "@/components/workouts/exercise-demo";
import { requireStaff } from "@/lib/auth/dal";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/workouts/labels";
import { getExercise } from "@/lib/workouts/queries";
import { updateExercise } from "../actions";
import { ExerciseForm } from "../exercise-form";
import { ArchiveExerciseButton } from "./archive-exercise-button";

export const metadata: Metadata = { title: "Exercício" };

const UUID = /^[0-9a-f-]{36}$/i;

async function ExerciseContent({ params }: Pick<PageProps<"/exercises/[exerciseId]">, "params">) {
  const { exerciseId } = await params;
  if (!UUID.test(exerciseId)) notFound();
  const user = await requireStaff();
  const exercise = await getExercise(exerciseId);
  if (!exercise) notFound();
  const editable = exercise.workspaceId === user.workspace.id;

  return (
    <div className="grid gap-8">
      <PageHeader
        title={exercise.name}
        description={`${MUSCLE_GROUP_LABELS[exercise.muscleGroup]} · ${EQUIPMENT_LABELS[exercise.equipment]}`}
        actions={<StatusBadge tone={exercise.isGlobal ? "info" : "success"}>{exercise.isGlobal ? "Biblioteca padrão" : "Meu exercício"}</StatusBadge>}
      />
      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Como executar</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <ExerciseDemo name={exercise.name} instructions={exercise.instructions} videoUrl={exercise.videoUrl} />
        </CardContent>
      </Card>
      {editable ? (
        <>
          <Card className="py-6 [--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold"><h2>Editar exercício</h2></CardTitle>
            </CardHeader>
            <CardContent>
              <ExerciseForm action={updateExercise.bind(null, exercise.id)} exercise={exercise} submitLabel="Salvar alterações" />
            </CardContent>
          </Card>
          <div>
            <ArchiveExerciseButton exerciseId={exercise.id} name={exercise.name} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Exercícios da biblioteca padrão não podem ser editados. Para uma versão personalizada, crie um novo exercício.
        </p>
      )}
    </div>
  );
}

export default function ExercisePage({ params }: PageProps<"/exercises/[exerciseId]">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/exercises" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Exercícios
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando exercício" />}>
        <ExerciseContent params={params} />
      </Suspense>
    </div>
  );
}
