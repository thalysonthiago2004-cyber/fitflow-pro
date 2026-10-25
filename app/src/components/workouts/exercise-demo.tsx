import { ExternalLink } from "lucide-react";
import { toEmbedUrl } from "@/lib/workouts/video";

type Props = { name: string; instructions: string | null; videoUrl: string | null; videoSrc?: string | null };

// Demonstration media and instructions. An uploaded video (signed URL) comes
// first; YouTube/Vimeo links are embedded (sandboxed); other links open in a new tab.
export function ExerciseDemo({ name, instructions, videoUrl, videoSrc = null }: Props) {
  const embed = toEmbedUrl(videoUrl);

  return (
    <div className="grid gap-4">
      {videoSrc ? (
        <video
          src={videoSrc}
          controls
          playsInline
          preload="metadata"
          aria-label={`Demonstração: ${name}`}
          className="aspect-video w-full rounded-lg border bg-black object-contain"
        />
      ) : embed ? (
        <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
          <iframe
            src={embed}
            title={`Demonstração: ${name}`}
            className="size-full"
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : videoUrl ? (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-info underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Ver demonstração
          <ExternalLink className="size-4" aria-hidden />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      ) : null}
      {instructions ? (
        <p className="text-sm leading-relaxed whitespace-pre-line">{instructions}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Sem instruções cadastradas.</p>
      )}
    </div>
  );
}
