"use client";

import { LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { attachVideo, removeVideo, requestVideoUpload } from "../actions";

const ACCEPT = "video/mp4,video/quicktime,video/webm";

// Sends the file straight to storage through a one-time signed URL, so large
// videos never pass through a server action. XHR gives upload progress.
function putFile(url: string, file: File, onProgress: (share: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}

export function VideoUpload({ exerciseId, hasVideo }: { exerciseId: string; hasVideo: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = pending || progress !== null;

  function upload(file: File) {
    startTransition(async () => {
      const ticket = await requestVideoUpload(exerciseId, file.type, file.size);
      if (!ticket.ok) return void toast.error(ticket.message);
      setProgress(0);
      const sent = await putFile(ticket.signedUrl, file, setProgress);
      setProgress(null);
      if (!sent) return void toast.error("O envio falhou. Verifique a conexão e tente de novo.");
      const result = await attachVideo(exerciseId, ticket.path);
      if (result.ok) toast.success("Vídeo enviado. Seus alunos já podem assistir.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Vídeo de demonstração"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) upload(file);
          }}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {progress !== null ? `Enviando… ${Math.round(progress * 100)}%` : hasVideo ? "Trocar vídeo" : "Enviar vídeo"}
        </Button>
        {hasVideo && (
          <ConfirmAction
            trigger={
              <Button type="button" variant="ghost" disabled={busy}>
                <Trash2 aria-hidden />
                Remover vídeo
              </Button>
            }
            title="Remover o vídeo?"
            description="O vídeo enviado deixa de aparecer para seus alunos."
            confirmLabel="Remover"
            successMessage="Vídeo removido."
            destructive
            onConfirm={() => removeVideo(exerciseId)}
          />
        )}
      </div>
      {progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-[var(--meter-track)]" role="progressbar" aria-label="Envio do vídeo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-full rounded-full bg-[var(--meter-fill)]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">MP4, MOV ou WebM, até 50 MB. Dica: grave em 720p e mantenha 20 a 40 segundos, para o vídeo ficar leve. Só você e seus alunos assistem.</p>
    </div>
  );
}
