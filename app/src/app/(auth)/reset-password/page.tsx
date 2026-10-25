import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { AuthCard } from "../auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nova senha" };

// Reached from the recovery e-mail (after /auth/confirm) or from settings.
// The proxy already redirects guests; this re-checks the session server-side.
async function AuthorizedForm() {
  await requireUser();
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Criar nova senha" description="Escolha uma senha que você não use em outros serviços.">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <AuthorizedForm />
      </Suspense>
    </AuthCard>
  );
}
