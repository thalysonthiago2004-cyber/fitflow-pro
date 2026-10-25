import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
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
      <Link href="/students" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ArrowLeft className="size-4" aria-hidden />
        Alunos
      </Link>
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
