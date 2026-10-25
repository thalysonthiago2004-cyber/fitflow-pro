"use client";

import { Camera, LoaderCircle } from "lucide-react";
import { useActionState, useRef, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { initialFormState } from "@/lib/auth/schemas";
import { UnsupportedImageError, prepareImage } from "@/lib/images/prepare";
import { removeAvatar, updateProfile, updateWorkspace, uploadAvatar } from "./actions";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, initialFormState);

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField
        name="fullName"
        label="Nome completo"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName ?? fullName}
        errors={state.fieldErrors?.fullName}
      />
      <FormField
        name="email"
        label="E-mail"
        type="email"
        value={email}
        readOnly
        disabled
        hint="A alteração de e-mail ainda não está disponível."
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="justify-self-start">
        Salvar perfil
      </SubmitButton>
    </form>
  );
}

export function WorkspaceForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateWorkspace, initialFormState);

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField
        name="name"
        label="Nome do espaço"
        required
        hint="Aparece para os seus alunos."
        defaultValue={state.values?.name ?? name}
        errors={state.fieldErrors?.name}
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="justify-self-start">
        Salvar espaço
      </SubmitButton>
    </form>
  );
}

export function AvatarForm({ fullName, avatarUrl, staff }: { fullName: string; avatarUrl: string | null; staff: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await prepareImage(file, { maxSize: 512, square: true });
      } catch (error) {
        toast.error(error instanceof UnsupportedImageError ? "Não foi possível ler essa imagem. Use JPG, PNG ou WebP." : "Não foi possível preparar a imagem.");
        return;
      }
      const data = new FormData();
      data.set("avatar", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const result = await uploadAvatar(data);
      if (result.ok) toast.success("Foto atualizada.");
      else toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeAvatar();
      if (result.ok) toast.success("Foto removida.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <UserAvatar name={fullName} src={avatarUrl} alt={avatarUrl ? "Sua foto de perfil" : ""} className="size-20 text-xl" />
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label="Foto de perfil"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload(file);
            }}
          />
          <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
            {avatarUrl ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {avatarUrl && (
            <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {staff ? "Seus alunos veem esta foto no app. " : ""}JPG, PNG ou WebP. A foto é recortada em quadrado.
        </p>
      </div>
    </div>
  );
}
