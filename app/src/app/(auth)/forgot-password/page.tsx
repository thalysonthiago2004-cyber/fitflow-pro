import type { Metadata } from "next";
import { AuthCard } from "../auth-card";
import { TextLink } from "../text-link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
      footer={<TextLink href="/login">Voltar para o login</TextLink>}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
