"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Password input with a toggle that reveals what was typed.
export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-11", className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute inset-y-0 right-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-controls={props.id}
        onClick={() => setVisible((v) => !v)}
        disabled={props.disabled}
      >
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </Button>
    </div>
  );
}
