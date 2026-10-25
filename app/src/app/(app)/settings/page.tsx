import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/roles";
import { avatarUrl } from "@/lib/images/urls";
import { AvatarForm, ProfileForm, WorkspaceForm } from "./settings-forms";

export const metadata: Metadata = { title: "Configurações" };

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

async function SettingsContent() {
  const user = await requireUser();

  return (
    <div className="grid max-w-2xl gap-6">
      <SettingsCard title="Perfil" description="Como você aparece para alunos e colegas.">
        <div className="grid gap-6">
          <AvatarForm fullName={user.fullName} avatarUrl={avatarUrl(user.avatarPath)} staff={isStaffRole(user.workspace?.role)} />
          <ProfileForm fullName={user.fullName} email={user.email} />
        </div>
      </SettingsCard>

      {user.workspace?.role === "owner" && (
        <SettingsCard title="Espaço de trabalho" description="Dados do seu negócio na plataforma.">
          <WorkspaceForm name={user.workspace.name} />
        </SettingsCard>
      )}

      <SettingsCard title="Segurança" description="Gerencie o acesso à sua conta.">
        <Link href="/reset-password" className={buttonVariants({ variant: "outline" })}>
          <KeyRound aria-hidden />
          Alterar senha
        </Link>
      </SettingsCard>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="grid gap-8">
      <PageHeader title="Configurações" description="Atualize seu perfil e as preferências da conta." />
      <Suspense fallback={<div className="h-96 max-w-2xl animate-pulse rounded-xl bg-muted" aria-label="Carregando" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
