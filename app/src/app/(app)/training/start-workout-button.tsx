"use client";

import { Play } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startWorkout } from "./actions";

export function StartWorkoutButton({ sessionId, className }: { sessionId: string; className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      className={className}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() =>
        startTransition(async () => {
          const result = await startWorkout(sessionId);
          if (!result.ok) toast.error(result.message);
        })
      }
    >
      <Play aria-hidden />
      {pending ? "Iniciando…" : "Iniciar treino"}
    </Button>
  );
}
