"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeWater } from "./actions";

export function RemoveWaterButton({ entryId, label, icon }: { entryId: string; label: string; icon: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Remover ${label}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeWater(entryId);
          if (!result.ok) toast.error(result.message);
        })
      }
    >
      {icon}
    </Button>
  );
}
