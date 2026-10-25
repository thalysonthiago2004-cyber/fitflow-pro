// Runs in the browser. Re-encoding through a canvas resizes the photo, applies
// its orientation and drops EXIF metadata (including GPS location) before
// anything leaves the device.

export class UnsupportedImageError extends Error {}

type Options = { maxSize: number; square?: boolean; quality?: number };

export async function prepareImage(file: File, { maxSize, square = false, quality = 0.85 }: Options): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnsupportedImageError();
  }

  // Square crops take the centered largest square.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = square ? (bitmap.width - side) / 2 : 0;
  const sy = square ? (bitmap.height - side) / 2 : 0;
  const sw = square ? side : bitmap.width;
  const sh = square ? side : bitmap.height;
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new UnsupportedImageError();
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new UnsupportedImageError();
  return blob;
}
