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
import { ThemeChoice } from "./theme-choice";
import { AvatarForm, BodyProfileForm, DeleteAccount, ProfileForm, WorkspaceForm } from "./settings-forms";

export const metadata: Metadata = { title: "Configurações" };

function SettingsCard({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 gap-6 py-6 [--card-spacing:--spacing(6)]">
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
    supabase.from("notification_preferences").select("workout_reminder_time, activity_alerts").eq("user_id", user.id).maybeSingle(),
  ]);

  const sections: [string, string][] = [
    ["perfil", "Perfil"],
    ...(user.workspace?.role === "owner" ? ([["negocio", "Espaço de trabalho"]] as [string, string][]) : []),
    ...(user.role === "student" && body ? ([["dados-fisicos", "Dados físicos"]] as [string, string][]) : []),
    ["aparencia", "Aparência"],
    ["notificacoes", "Notificações"],
    ["seguranca", "Segurança"],
    ["privacidade", "Privacidade e dados"],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,42rem)] lg:items-start lg:gap-10">
      <nav aria-label="Seções das configurações" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:sticky lg:top-24">
        <ul className="flex w-max gap-1 lg:w-auto lg:flex-col">
          {sections.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="flex h-9 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:rounded-lg">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid gap-6">
        <SettingsCard id="perfil" title="Perfil" description="Como você aparece para alunos e colegas.">
          <div className="grid gap-6">
            <AvatarForm fullName={user.fullName} avatarUrl={avatarUrl(user.avatarPath)} staff={isStaffRole(user.workspace?.role)} />
            <ProfileForm fullName={user.fullName} email={user.email} whatsapp={user.role === "trainer" ? user.whatsapp : undefined} />
          </div>
        </SettingsCard>

        {user.workspace?.role === "owner" && (
          <SettingsCard id="negocio" title="Espaço de trabalho" description="Dados do seu negócio na plataforma.">
            <WorkspaceForm name={user.workspace.name} />
          </SettingsCard>
        )}

        {user.role === "student" && body && (
          <SettingsCard id="dados-fisicos" title="Dados físicos" description="Sexo, altura e data de nascimento.">
            <BodyProfileForm sex={body.sex} heightCm={body.heightCm} birthDate={body.birthDate} />
          </SettingsCard>
        )}

        <SettingsCard id="aparencia" title="Aparência" description="Escolha como o FitFlow aparece para você.">
          <ThemeChoice />
        </SettingsCard>

        <SettingsCard id="notificacoes" title="Notificações" description="Lembretes no celular, mesmo com o app fechado.">
          <NotificationsCard isStudent={user.role === "student"} workoutTime={prefs.data?.workout_reminder_time?.slice(0, 5) ?? null} activityAlerts={prefs.data?.activity_alerts ?? true} />
        </SettingsCard>

        <SettingsCard id="seguranca" title="Segurança" description="Gerencie o acesso à sua conta.">
          <Link href="/reset-password" className={buttonVariants({ variant: "outline" })}>
            <KeyRound aria-hidden />
            Alterar senha
          </Link>
        </SettingsCard>

        <SettingsCard id="privacidade" title="Privacidade e dados" description="Seus direitos pela LGPD.">
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              <a href="/settings/export" download className={buttonVariants({ variant: "outline" })}>
                <Download aria-hidden />
                Baixar meus dados
              </a>
              <Link href="/privacidade" className={buttonVariants({ variant: "ghost" })}>Política de privacidade</Link>
              <Link href="/termos" className={buttonVariants({ variant: "ghost" })}>Termos de uso</Link>
            </div>
            <DeleteAccount email={user.email} ownsWorkspace={user.workspace?.role === "owner"} />
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="grid gap-8">
      <PageHeader title="Configurações" description="Atualize seu perfil e as preferências da conta." />
      <Suspense fallback={<div role="status" className="h-96 max-w-3xl animate-pulse rounded-xl bg-muted" aria-label="Carregando" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
