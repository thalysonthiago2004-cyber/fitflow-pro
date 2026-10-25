import "server-only";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export type ImageCheck = { ok: true; file: File } | { ok: false; message: string };

/**
 * Accepts only JPEG files under `maxBytes`. The browser re-encodes every image
 * before upload, so anything else did not come from our form. The magic bytes
 * are checked because the declared type is client-controlled.
 */
export async function checkJpeg(value: FormDataEntryValue | null, maxBytes: number): Promise<ImageCheck> {
  if (!(value instanceof File) || value.size === 0) return { ok: false, message: "Selecione uma imagem." };
  if (value.size > maxBytes) return { ok: false, message: "A imagem é grande demais. Tente outra foto." };
  const head = new Uint8Array(await value.slice(0, 3).arrayBuffer());
  if (value.type !== "image/jpeg" || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
    return { ok: false, message: "Formato de imagem não suportado. Use JPG, PNG ou WebP." };
  }
  return { ok: true, file: value };
}
