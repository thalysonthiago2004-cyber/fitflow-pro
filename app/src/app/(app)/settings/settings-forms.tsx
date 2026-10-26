"use client";

import { Camera, LoaderCircle } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { initialFormState } from "@/lib/auth/schemas";
import { formatNumber, todayISO } from "@/lib/format";
import { UnsupportedImageError, prepareImage } from "@/lib/images/prepare";
import { deleteAccount, removeAvatar, updateMyBodyProfile, updateProfile, updateWorkspace, uploadAvatar } from "./actions";

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

export function BodyProfileForm({ sex, heightCm, birthDate }: { sex: string | null; heightCm: number | null; birthDate: string | null }) {
  const [state, action, pending] = useActionState(updateMyBodyProfile, initialFormState);
  const v = state.values;
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-3">
        <SelectField
          name="sex"
          id="body-sex"
          label="Sexo"
          placeholder="Não informado"
          options={[{ value: "female", label: "Feminino" }, { value: "male", label: "Masculino" }]}
          defaultValue={v?.sex ?? sex ?? ""}
          errors={state.fieldErrors?.sex}
        />
        <FormField name="heightCm" id="body-height" label="Altura (cm)" inputMode="decimal" placeholder="Ex.: 172,5" defaultValue={v?.heightCm ?? (heightCm === null ? "" : formatNumber(heightCm))} errors={state.fieldErrors?.heightCm} />
        <FormField name="birthDate" id="body-birth" label="Data de nascimento" type="date" min="1900-01-01" max={todayISO()} defaultValue={v?.birthDate ?? birthDate ?? ""} errors={state.fieldErrors?.birthDate} />
      </div>
      <p className="text-xs text-muted-foreground">Usados nas estimativas da avaliação corporal. Seu personal também pode atualizar.</p>
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">Salvar dados</SubmitButton>
    </form>
  );
}

export function DeleteAccount({ ownsWorkspace }: { ownsWorkspace: boolean }) {
  const [confirmation, setConfirmation] = useState("");
  return (
    <div className="grid gap-3 rounded-lg border border-destructive/40 p-4">
      <p className="text-sm">
        {ownsWorkspace
          ? "Excluir sua conta apaga seu espaço de trabalho e todos os dados dos seus alunos nele: planos, registros, medidas e fotos. Os alunos continuam com a própria conta, sem personal."
          : "Excluir sua conta apaga seus registros de treino, medidas, fotos e demais dados. Essa ação não pode ser desfeita."}
      </p>
      <ConfirmAction
        trigger={<Button type="button" variant="destructive" className="sm:justify-self-start">Excluir minha conta</Button>}
        title="Excluir sua conta definitivamente?"
        description={
          <span className="grid gap-3">
            <span>Essa ação não pode ser desfeita. Digite EXCLUIR para confirmar.</span>
            <input
              aria-label="Digite EXCLUIR para confirmar"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              className="h-11 rounded-lg border border-input bg-transparent px-3 text-base text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </span>
        }
        confirmLabel="Excluir conta"
        destructive
        onConfirm={() => deleteAccount(confirmation)}
      />
    </div>
  );
}
