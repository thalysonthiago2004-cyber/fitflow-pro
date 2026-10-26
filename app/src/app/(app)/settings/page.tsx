import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/roles";
import { avatarUrl } from "@/lib/images/urls";
import { getBodyProfile } from "@/lib/progress/queries";
import { createClient } from "@/lib/supabase/server";
import { NotificationsCard } from "./notifications-card";
import { AvatarForm, BodyProfileForm, DeleteAccount, ProfileForm, WorkspaceForm } from "./settings-forms";

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
  const supabase = await createClient();
  const [body, prefs] = await Promise.all([
    user.role === "student" ? getBodyProfile(user.id) : null,
    supabase.from("notification_preferences").select("workout_reminder_time").eq("user_id", user.id).maybeSingle(),
  ]);

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

      {user.role === "student" && body && (
        <SettingsCard title="Dados físicos" description="Sexo, altura e data de nascimento.">
          <BodyProfileForm sex={body.sex} heightCm={body.heightCm} birthDate={body.birthDate} />
        </SettingsCard>
      )}

      <SettingsCard title="Notificações" description="Lembretes no celular, mesmo com o app fechado.">
        <NotificationsCard isStudent={user.role === "student"} workoutTime={prefs.data?.workout_reminder_time?.slice(0, 5) ?? null} />
      </SettingsCard>

      <SettingsCard title="Segurança" description="Gerencie o acesso à sua conta.">
        <Link href="/reset-password" className={buttonVariants({ variant: "outline" })}>
          <KeyRound aria-hidden />
          Alterar senha
        </Link>
      </SettingsCard>

      <SettingsCard title="Privacidade e dados" description="Seus direitos pela LGPD.">
        <div className="grid gap-5">
          <div className="flex flex-wrap gap-2">
            <a href="/settings/export" download className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden />
              Baixar meus dados
            </a>
            <Link href="/privacidade" className={buttonVariants({ variant: "ghost" })}>Política de privacidade</Link>
            <Link href="/termos" className={buttonVariants({ variant: "ghost" })}>Termos de uso</Link>
          </div>
          <DeleteAccount ownsWorkspace={user.workspace?.role === "owner"} />
        </div>
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
