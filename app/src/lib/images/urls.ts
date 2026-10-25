import { getPublicEnv } from "@/lib/env";

/** Public URL of a file in the `avatars` bucket. */
export function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return `${getPublicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}
