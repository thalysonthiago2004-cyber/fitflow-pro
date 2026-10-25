import type { Metadata } from "next";
import { AuthCard } from "../auth-card";
import { TextLink } from "../text-link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Entrar"
      description="Acesse seu painel para acompanhar alunos e treinos."
      footer={
        <p>
          Ainda não tem conta? <TextLink href="/signup">Criar conta</TextLink>
        </p>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
