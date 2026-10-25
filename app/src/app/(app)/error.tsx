"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "../(auth)/actions";

export default function AppError({ retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto grid max-w-md justify-items-center gap-4 py-16 text-center">
      <CircleAlert className="size-8 text-destructive" aria-hidden />
      <div className="grid gap-1">
        <h1 className="font-heading text-xl font-semibold">Não foi possível carregar sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Tente novamente. Se o problema continuar, saia e entre de novo.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>Tentar novamente</Button>
        <form action={logout}>
          <Button type="submit" variant="outline">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
