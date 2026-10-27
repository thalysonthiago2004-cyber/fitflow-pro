// Turns a YouTube or Vimeo link into a privacy-friendly embed URL. Anything
// else returns null and is shown as a plain external link.
export function toEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  let youtubeId: string | null = null;
  if (host === "youtu.be") youtubeId = url.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") youtubeId = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      youtubeId = match?.[1] ?? null;
    }
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/(?:^|\/)(\d{5,12})(?:$|\/)/);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  return null;
}

export type VideoSource = "youtube" | "vimeo" | "tiktok" | "instagram" | "link";

/** Where a demonstration link points, for labels ("Ver no TikTok"). */
export function videoSource(raw: string): VideoSource {
  let host: string;
  try {
    host = new URL(raw).hostname.replace(/^(www|m|vm)\./, "");
  } catch {
    return "link";
  }
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") return "youtube";
  if (host === "vimeo.com" || host === "player.vimeo.com") return "vimeo";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "instagram.com" || host === "instagr.am") return "instagram";
  return "link";
}
