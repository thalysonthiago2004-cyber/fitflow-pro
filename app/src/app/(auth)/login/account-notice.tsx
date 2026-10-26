"use client";

import { useSearchParams } from "next/navigation";

// Shown after an account is deleted from Settings.
export function AccountNotice() {
  const params = useSearchParams();
  if (params.get("conta") !== "excluida") return null;
  return (
    <p role="status" className="rounded-lg border bg-muted/50 p-3 text-sm">
      Sua conta e seus dados foram excluídos.
    </p>
  );
}
