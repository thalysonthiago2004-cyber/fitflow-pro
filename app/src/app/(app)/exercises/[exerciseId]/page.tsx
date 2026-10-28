import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
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
import { CustomizationForm } from "./customization-form";
import { VideoUpload } from "./video-upload";

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
        actions={
          <StatusBadge tone={exercise.isGlobal ? "info" : "success"}>
            {exercise.isGlobal ? (exercise.customized ? "Biblioteca padrão · personalizado" : "Biblioteca padrão") : "Meu exercício"}
          </StatusBadge>
        }
      />
      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Como executar</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <ExerciseDemo name={exercise.name} instructions={exercise.instructions} videoUrl={exercise.videoUrl} videoSrc={exercise.videoSrc} />
        </CardContent>
      </Card>
      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Vídeo de demonstração</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <VideoUpload exerciseId={exercise.id} hasVideo={exercise.videoPath !== null} />
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
        <Card className="py-6 [--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold"><h2>Personalizar para meus alunos</h2></CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Escreva do seu jeito como executar e coloque seu próprio vídeo. A biblioteca padrão não muda para outros personais; seus treinos continuam usando este exercício.
            </p>
            <CustomizationForm exercise={exercise} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ExercisePage({ params }: PageProps<"/exercises/[exerciseId]">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <BackLink href="/exercises">Exercícios</BackLink>
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Carregando exercício" />}>
        <ExerciseContent params={params} />
      </Suspense>
    </div>
  );
}
