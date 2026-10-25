import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../../actions";
import { AuthCard } from "../../auth-card";
import { TextLink } from "../../text-link";
import { AcceptInviteButton } from "./accept-invite-button";
import { InviteSignupForm } from "./invite-signup-form";

export const metadata: Metadata = { title: "Convite", referrer: "no-referrer" };

const INVITE_TOKEN = /^[0-9a-f]{64}$/;

async function InviteContent({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = INVITE_TOKEN.test(token)
    ? await supabase.rpc("get_invitation", { p_token: token })
    : { data: null };
  const invitation = data?.[0];

  if (!invitation) {
    return (
      <AuthCard
        title="Convite inválido ou expirado"
        description="Este link já foi usado, foi cancelado ou passou da validade. Peça um novo link ao seu personal."
        footer={<TextLink href="/login">Ir para o login</TextLink>}
      />
    );
  }

  const user = await getCurrentUser();
  const intro = `${invitation.trainer_name} convidou você para acompanhar seus treinos em ${invitation.workspace_name}.`;

  if (!user) {
    const next = encodeURIComponent(`/invite/${token}`);
    return (
      <AuthCard
        title="Você recebeu um convite"
        description={`${intro} Válido até ${formatDate(invitation.expires_at)}.`}
        footer={
          <p>
            Já tem conta de aluno? <TextLink href={`/login?next=${next}`}>Entrar e aceitar</TextLink>
          </p>
        }
      >
        <InviteSignupForm token={token} email={invitation.email} suggestedName={invitation.full_name} />
      </AuthCard>
    );
  }

  if (user.role === "trainer") {
    return (
      <AuthCard
        title="Esta conta é de personal"
        description={`Você está conectado como ${user.email}. Para aceitar o convite como aluno, saia e use o e-mail ${invitation.email}.`}
      >
        <form action={logout}>
          <button type="submit" className={buttonVariants({ variant: "outline", className: "w-full" })}>
            Sair
          </button>
        </form>
      </AuthCard>
    );
  }

  if (user.workspace) {
    return (
      <AuthCard
        title="Sua conta já tem um personal"
        description={`Você já acompanha seus treinos em ${user.workspace.name}. Para trocar, peça ao seu personal atual para encerrar o vínculo.`}
      >
        <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
          Ir para o painel
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Aceitar convite" description={intro}>
      <AcceptInviteButton token={token} />
    </AuthCard>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando convite" />}>
      <InviteContent params={params} />
    </Suspense>
  );
}
