"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";

type InviteLinkPanelProps = { url: string; expiresAt?: string; studentName?: string };

export function InviteLinkPanel({ url, expiresAt, studentName }: InviteLinkPanelProps) {
  const [copied, setCopied] = useState(false);
  const message = `Olá${studentName ? `, ${studentName.split(" ")[0]}` : ""}! Este é o seu convite para acessar seus treinos no FitFlow Pro: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="invite-link">Link de convite</Label>
        <Input id="invite-link" value={url} readOnly onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
        <p className="text-xs text-muted-foreground">
          {expiresAt ? `Válido até ${formatDateTime(expiresAt)}. ` : ""}O link é pessoal e funciona uma única vez.
          Por segurança, ele não poderá ser exibido de novo; se perder, gere um novo.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <MessageCircle aria-hidden />
          Enviar pelo WhatsApp
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </div>
    </div>
  );
}
