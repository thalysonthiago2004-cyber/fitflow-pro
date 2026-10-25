import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <BrandLogo size={32} />
      <div className="grid gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          O endereço pode estar errado ou o conteúdo não está disponível para a sua conta.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants()}>Ir para o painel</Link>
    </main>
  );
}
