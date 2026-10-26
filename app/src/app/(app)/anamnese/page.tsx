import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HeartPulse } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { QuestionnaireSummary } from "@/components/students/questionnaire-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { getLatestQuestionnaire } from "@/lib/students/questionnaire-queries";
import { QuestionnaireForm } from "./questionnaire-form";

export const metadata: Metadata = { title: "Anamnese" };

async function Content({ searchParams }: Pick<PageProps<"/anamnese">, "searchParams">) {
  const user = await requireUser();
  if (user.role !== "student") redirect("/dashboard");
  if (!user.workspace) return <EmptyState icon={HeartPulse} title="Você ainda não tem um personal" description="A anamnese fica disponível depois que você aceitar um convite." />;
  const [latest, params] = await Promise.all([getLatestQuestionnaire(user.id), searchParams]);

  return (
    <div className="grid gap-6">
      {latest && (
        <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold"><h2>{params.enviado ? "Respostas enviadas" : "Suas últimas respostas"}</h2></CardTitle>
          </CardHeader>
          <CardContent><QuestionnaireSummary questionnaire={latest} /></CardContent>
        </Card>
      )}
      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>{latest ? "Atualizar respostas" : "Questionário de prontidão (PAR-Q)"}</h2></CardTitle>
        </CardHeader>
        <CardContent><QuestionnaireForm previous={latest?.answers ?? null} /></CardContent>
      </Card>
    </div>
  );
}

export default function AnamnesePage({ searchParams }: PageProps<"/anamnese">) {
  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader title="Anamnese" description="Algumas perguntas de saúde para seu personal montar treinos seguros. Leva 2 minutos." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando anamnese" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
