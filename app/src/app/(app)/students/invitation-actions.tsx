"use client";

import { RefreshCw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { InviteLinkPanel } from "@/components/invite-link-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { refreshInvitation, revokeInvitation } from "./actions";

export function InvitationActions({ invitationId, studentName }: { invitationId: string; studentName: string }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<{ url: string; expiresAt?: string } | null>(null);

  function generate() {
    startTransition(async () => {
      const result = await refreshInvitation(invitationId);
      if (!result.ok) return void toast.error(result.message);
      if (result.inviteUrl) setLink({ url: result.inviteUrl, expiresAt: result.expiresAt });
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={generate} disabled={pending} aria-busy={pending || undefined}>
        <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
        Gerar novo link
      </Button>
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="sm">
            <X aria-hidden />
            Cancelar convite
          </Button>
        }
        title="Cancelar convite?"
        description={`O link enviado para ${studentName} deixará de funcionar.`}
        confirmLabel="Cancelar convite"
        successMessage="Convite cancelado."
        destructive
        onConfirm={() => revokeInvitation(invitationId)}
      />
      <Dialog open={link !== null} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo link de convite</DialogTitle>
            <DialogDescription>O link anterior deixou de funcionar. Envie este para {studentName}.</DialogDescription>
          </DialogHeader>
          {link && <InviteLinkPanel url={link.url} expiresAt={link.expiresAt} studentName={studentName} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
