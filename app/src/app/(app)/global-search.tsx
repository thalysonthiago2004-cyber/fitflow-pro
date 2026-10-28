"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

// Staff search: finds students by name or e-mail. "/" focuses it from anywhere.
export function GlobalSearch() {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/students" role="search" className="relative w-full max-w-sm">
      <label htmlFor="global-search" className="sr-only">
        Buscar aluno
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={input}
        id="global-search"
        name="q"
        type="search"
        maxLength={80}
        placeholder="Buscar aluno por nome ou e-mail"
        className="h-10 w-full rounded-full border border-input bg-card pr-10 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border px-1.5 font-mono text-[11px] text-muted-foreground" aria-hidden>
        /
      </kbd>
    </form>
  );
}
