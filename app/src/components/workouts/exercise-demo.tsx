import { ExternalLink } from "lucide-react";
import { toEmbedUrl, type VideoSource, videoSource } from "@/lib/workouts/video";

type VideoProps = { name: string; videoUrl: string | null; videoSrc?: string | null };

const LINK_LABELS: Record<VideoSource, string> = {
  youtube: "Ver no YouTube",
  vimeo: "Ver no Vimeo",
  tiktok: "Ver no TikTok",
  instagram: "Ver no Instagram",
  link: "Ver demonstração",
};

// An uploaded video (signed URL) comes first; YouTube/Vimeo links are
// embedded (sandboxed); other links (TikTok, Instagram…) open in a new tab.
export function ExerciseVideo({ name, videoUrl, videoSrc = null }: VideoProps) {
  const embed = toEmbedUrl(videoUrl);
  if (videoSrc) {
    return (
      <video
        src={videoSrc}
        controls
        playsInline
        preload="metadata"
        aria-label={`Demonstração: ${name}`}
        className="aspect-video w-full rounded-lg border bg-black object-contain"
      />
    );
  }
  if (embed) {
    return (
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
    );
  }
  if (!videoUrl) return null;
  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-info underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {LINK_LABELS[videoSource(videoUrl)]}
      <ExternalLink className="size-4" aria-hidden />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

type Props = VideoProps & { instructions: string | null };

// Demonstration media and instructions.
export function ExerciseDemo({ name, instructions, videoUrl, videoSrc = null }: Props) {
  return (
    <div className="grid gap-4">
      <ExerciseVideo name={name} videoUrl={videoUrl} videoSrc={videoSrc} />
      {instructions ? (
        <p className="text-sm leading-relaxed whitespace-pre-line">{instructions}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Sem instruções cadastradas.</p>
      )}
    </div>
  );
}
