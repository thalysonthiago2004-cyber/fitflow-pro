"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// The browser's print dialog also offers "Save as PDF".
export function PrintButton({ label = "Salvar em PDF ou imprimir" }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
