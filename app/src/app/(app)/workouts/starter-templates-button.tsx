"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addStarterTemplates } from "./actions";

export function StarterTemplatesButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await addStarterTemplates();
          if (!result.ok) return void toast.error(result.message);
          toast.success(result.added ? `${result.added} ${result.added === 1 ? "modelo adicionado" : "modelos adicionados"}. Ajuste ao seu estilo antes de usar.` : "Os modelos prontos já estão na sua biblioteca.");
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
      Adicionar modelos prontos
    </Button>
  );
}
