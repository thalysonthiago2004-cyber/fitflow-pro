import { cn } from "@/lib/utils";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

// Photo when there is one, initials otherwise. Decorative by default: the
// person's name is always shown or announced next to it.
export function UserAvatar({ name, src, className, alt = "" }: { name: string; src: string | null; className?: string; alt?: string }) {
  if (src) {
    // Storage URLs are already sized on upload; next/image would only re-proxy them.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={cn("size-9 shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground", className)}
      aria-hidden={alt ? undefined : true}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      {initials(name)}
    </span>
  );
}
