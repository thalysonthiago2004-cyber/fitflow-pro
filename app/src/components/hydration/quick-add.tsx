"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addWater, removeWater } from "@/app/(app)/hydration/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVolume } from "@/lib/format";

const PRESETS = [200, 300, 500];

/** `compact` keeps only the preset buttons (for the home screen). */
export function QuickAdd({ compact = false }: { compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState("");

  function add(amount: number | string) {
    startTransition(async () => {
      const result = await addWater(amount);
      if (!result.ok) return void toast.error(result.message);
      setCustom("");
      toast.success(`${formatVolume(Number(amount))} registrados.`, {
        action: {
          label: "Desfazer",
          onClick: () =>
            startTransition(async () => {
              const undo = await removeWater(result.id);
              if (!undo.ok) toast.error(undo.message);
            }),
        },
      });
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((ml) => (
          <Button key={ml} variant="outline" size="lg" disabled={pending} onClick={() => add(ml)} aria-label={`Adicionar ${formatVolume(ml)}`}>
            <Plus aria-hidden />
            {ml} ml
          </Button>
        ))}
      </div>
      {!compact && <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (custom) add(custom);
        }}
      >
        <div className="grid flex-1 gap-2">
          <Label htmlFor="custom-water">Outra quantidade (ml)</Label>
          <Input id="custom-water" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Ex.: 750" />
        </div>
        <Button type="submit" variant="secondary" disabled={pending || !custom}>
          Adicionar
        </Button>
      </form>}
    </div>
  );
}
