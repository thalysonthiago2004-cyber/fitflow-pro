"use client";

import { Camera, ImageOff, LoaderCircle, Lock, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProgressPhoto, uploadProgressPhoto } from "@/app/(app)/progress/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, todayISO } from "@/lib/format";
import { UnsupportedImageError, prepareImage } from "@/lib/images/prepare";
import type { ProgressPhoto } from "@/lib/progress/photos";
import { POSE_LABELS } from "@/lib/progress/schemas";
import type { PhotoPose } from "@/lib/supabase/database.types";

const POSES = Object.keys(POSE_LABELS) as PhotoPose[];
const POSE_OPTIONS = POSES.map((value) => ({ value, label: POSE_LABELS[value] }));

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);
}

function Frame({ photo, label }: { photo: ProgressPhoto | undefined; label: string }) {
  return (
    <figure className="grid gap-2">
      <div className="aspect-[3/4] overflow-hidden rounded-xl border bg-muted">
        {photo ? (
          // Signed storage URLs expire; next/image would cache them past that.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={`${label}: ${POSE_LABELS[photo.pose].toLowerCase()} em ${formatDate(photo.takenOn)}`} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" aria-hidden />
          </div>
        )}
      </div>
      <figcaption className="text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground tabular-nums">{photo ? ` · ${formatDate(photo.takenOn)}` : " · sem foto"}</span>
      </figcaption>
    </figure>
  );
}

function PhotoUpload() {
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    const takenOn = form.current?.querySelector<HTMLInputElement>("[name=takenOn]")?.value ?? "";
    const pose = form.current?.querySelector<HTMLSelectElement>("[name=pose]")?.value ?? "";
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await prepareImage(file, { maxSize: 1600 });
      } catch (error) {
        toast.error(error instanceof UnsupportedImageError ? "Não foi possível ler essa imagem. Use JPG, PNG ou WebP." : "Não foi possível preparar a imagem.");
        return;
      }
      const data = new FormData();
      data.set("takenOn", takenOn);
      data.set("pose", pose);
      data.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const result = await uploadProgressPhoto(data);
      if (result.ok) toast.success("Foto adicionada.");
      else toast.error(result.message);
    });
  }

  return (
    <div ref={form} className="grid items-end gap-4 rounded-xl border border-dashed p-4 sm:grid-cols-[1fr_1fr_auto]">
      <FormField name="takenOn" id="photo-taken-on" label="Data da foto" type="date" max={todayISO()} defaultValue={todayISO()} />
      <SelectField name="pose" id="photo-pose" label="Posição" options={POSE_OPTIONS} defaultValue="front" />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Foto de evolução"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload(file);
        }}
      />
      <Button type="button" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
        {pending ? "Enviando…" : "Adicionar foto"}
      </Button>
    </div>
  );
}

// Before/after comparison per pose. Photos are private: signed URLs, visible
// only to the student and their trainer.
export function ProgressPhotos({ photos, canEdit }: { photos: ProgressPhoto[]; canEdit: boolean }) {
  const firstPose = POSES.find((p) => photos.some((photo) => photo.pose === p)) ?? "front";
  const [pose, setPose] = useState<PhotoPose>(firstPose);
  const ofPose = photos.filter((p) => p.pose === pose);
  const [choice, setChoice] = useState<{ pose: PhotoPose; before: string; after: string } | null>(null);
  // Defaults: the first and the latest photo of this pose.
  const beforeId = choice?.pose === pose ? choice.before : ofPose[0]?.id;
  const afterId = choice?.pose === pose ? choice.after : ofPose.at(-1)?.id;
  const before = ofPose.find((p) => p.id === beforeId);
  const after = ofPose.length > 1 ? ofPose.find((p) => p.id === afterId) : undefined;
  const options = ofPose.map((p) => ({ value: p.id, label: formatDate(p.takenOn) }));
  const days = before && after ? daysBetween(before.takenOn, after.takenOn) : null;

  return (
    <div className="grid gap-5">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" aria-hidden />
        Fotos privadas: só o aluno e o personal dele podem ver.
      </p>

      {canEdit && <PhotoUpload />}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit ? "Adicione a primeira foto para começar a comparar. Use a mesma posição, luz e distância nas próximas." : "O aluno ainda não adicionou fotos."}
        </p>
      ) : (
        <>
          <Tabs value={pose} onValueChange={(value) => setPose(value as PhotoPose)}>
            <TabsList className="h-11 w-full sm:w-fit group-data-horizontal/tabs:h-11">
              {POSES.map((p) => (
                <TabsTrigger key={p} value={p} className="px-4">{POSE_LABELS[p]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {ofPose.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              {ofPose.length === 0 ? "Nenhuma foto nesta posição." : "Com uma segunda foto nesta posição, a comparação aparece aqui."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:max-w-xl sm:gap-4">
              <SelectField name="before" id="compare-before" label="Antes" options={options} value={beforeId} onChange={(e) => setChoice({ pose, before: e.target.value, after: afterId! })} />
              <SelectField name="after" id="compare-after" label="Depois" options={options} value={afterId} onChange={(e) => setChoice({ pose, before: beforeId!, after: e.target.value })} />
            </div>
          )}

          {ofPose.length > 0 && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3 sm:max-w-xl sm:gap-4">
                <Frame photo={before} label="Antes" />
                <Frame photo={after} label="Depois" />
              </div>
              {days !== null && days !== 0 && (
                <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                  {Math.abs(days)} {Math.abs(days) === 1 ? "dia" : "dias"} entre as fotos.
                </p>
              )}
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer text-sm font-semibold">Todas as fotos ({photos.length})</summary>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[...photos].reverse().map((p) => (
                <li key={p.id} className="grid gap-1">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`${POSE_LABELS[p.pose]} em ${formatDate(p.takenOn)}`} className="size-full object-cover" loading="lazy" />
                    {canEdit && (
                      <div className="absolute top-1 right-1">
                        <ConfirmAction
                          trigger={<Button variant="secondary" size="icon-sm" aria-label={`Excluir foto de ${formatDate(p.takenOn)}`}><Trash2 aria-hidden /></Button>}
                          title="Excluir foto?"
                          description="A foto será apagada para você e para o seu personal."
                          confirmLabel="Excluir"
                          successMessage="Foto excluída."
                          destructive
                          onConfirm={() => deleteProgressPhoto(p.id)}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{POSE_LABELS[p.pose]} · {formatDate(p.takenOn)}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
