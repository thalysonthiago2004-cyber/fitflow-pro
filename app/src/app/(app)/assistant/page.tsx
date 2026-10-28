import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/dal";
import { assistantEnabled } from "@/lib/assistant/run";
import { linkedQuestion } from "@/lib/assistant/suggestions";
import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "Assistente" };

async function Content({ searchParams }: { searchParams: PageProps<"/assistant">["searchParams"] }) {
  const user = await requireUser();
  if (!assistantEnabled()) {
    return <EmptyState icon={Sparkles} title="Assistente ainda não ativado" description="O assistente de IA ficará disponível aqui em breve." />;
  }
  const role = user.workspace?.role === "student" || (!user.workspace && user.role === "student") ? "student" : "staff";
  const { q } = await searchParams;
  return <AssistantChat userId={user.id} role={role} firstName={user.fullName.trim().split(/\s+/)[0] ?? ""} initialQuestion={linkedQuestion(role, q)} />;
}

export default function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Assistente" description="Tire dúvidas sobre treinos e sobre o app e veja vídeos dos exercícios." />
      <Suspense fallback={<div role="status" className="h-72 animate-pulse rounded-2xl bg-muted" aria-label="Carregando assistente" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
