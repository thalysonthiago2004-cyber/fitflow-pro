"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { addComment, deleteComment } from "@/app/(app)/training/comment-actions";
import { ConfirmAction } from "@/components/confirm-action";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";

export function CommentForm({ logId }: { logId: string }) {
  const [state, action, pending] = useActionState(addComment.bind(null, logId), initialFormState);
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <TextareaField name="body" id={`comment-${logId}`} label="Escreva um comentário" placeholder="Ex.: ótima evolução no agachamento!" maxLength={1000} defaultValue={state.status === "error" ? state.values?.body : ""} errors={state.fieldErrors?.body} />
      <SubmitButton pending={pending} pendingLabel="Enviando…" className="sm:justify-self-start">Comentar</SubmitButton>
    </form>
  );
}

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="icon-sm" aria-label="Apagar comentário"><Trash2 aria-hidden /></Button>}
      title="Apagar comentário?"
      description="O comentário some para você e para a outra pessoa."
      confirmLabel="Apagar"
      successMessage="Comentário apagado."
      destructive
      onConfirm={() => deleteComment(commentId)}
    />
  );
}
