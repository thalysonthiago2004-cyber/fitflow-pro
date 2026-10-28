"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "dark", label: "Escuro", hint: "Padrão do FitFlow", icon: Moon },
  { value: "light", label: "Claro", hint: "Melhor sob luz forte", icon: Sun },
  { value: "system", label: "Do aparelho", hint: "Segue o celular ou computador", icon: Monitor },
] as const;

// The saved theme is only known in the browser: render unselected on the server.
const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">Tema</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map(({ value, label, hint, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 outline-none has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              mounted && theme === value ? "border-foreground bg-accent dark:border-brand" : "hover:bg-accent/60",
            )}
          >
            <input type="radio" name="theme" value={value} checked={mounted && theme === value} onChange={() => setTheme(value)} className="absolute inset-0 cursor-pointer opacity-0" />
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span className="grid">
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Fica salvo neste aparelho.</p>
    </fieldset>
  );
}
