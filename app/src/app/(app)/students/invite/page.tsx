import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/dal";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Convidar aluno" };

async function AuthorizedInviteForm() {
  await requireStaff();
  return <InviteForm />;
}

export default function InviteStudentPage() {
  return (
    <div className="grid max-w-2xl gap-8">
      <BackLink href="/students">Alunos</BackLink>
      <PageHeader
        title="Convidar aluno"
        description="Gere um link pessoal e envie para o aluno por WhatsApp ou e-mail. Ele cria a conta e já entra vinculado a você."
      />
      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardContent>
          <Suspense fallback={<div className="h-64" aria-hidden />}>
            <AuthorizedInviteForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
