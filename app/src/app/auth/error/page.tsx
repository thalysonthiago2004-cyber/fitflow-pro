import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Link inválido" };

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <BrandLogo size={32} />
      <Card className="w-full max-w-md gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CircleAlert className="mb-2 size-6 text-destructive" aria-hidden />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Link inválido ou expirado
          </h1>
          <CardDescription>
            Os links enviados por e-mail valem por tempo limitado e só podem ser usados uma vez.
            Solicite um novo para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Link href="/forgot-password" className={buttonVariants()}>
            Recuperar senha
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Ir para o login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
