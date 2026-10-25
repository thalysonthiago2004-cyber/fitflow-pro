import type { Metadata } from "next";
import { AuthCard } from "../auth-card";
import { TextLink } from "../text-link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Criar conta de personal"
      description="Cadastre-se para montar seu espaço de trabalho. Alunos entram por convite do personal."
      footer={
        <p>
          Já tem conta? <TextLink href="/login">Entrar</TextLink>
        </p>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
