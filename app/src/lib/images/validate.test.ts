import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { checkJpeg } = await import("./validate");

const jpeg = (size = 10) => new File([new Uint8Array([0xff, 0xd8, 0xff, ...new Array(size).fill(0)])], "a.jpg", { type: "image/jpeg" });

describe("checkJpeg", () => {
  it("accepts a JPEG under the limit", async () => {
    expect((await checkJpeg(jpeg(), 1024)).ok).toBe(true);
  });
  it("rejects missing, oversized and disguised files", async () => {
    expect(await checkJpeg(null, 1024)).toEqual({ ok: false, message: "Selecione uma imagem." });
    expect((await checkJpeg(jpeg(2048), 1024)).ok).toBe(false);
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.jpg", { type: "image/jpeg" });
    expect((await checkJpeg(png, 1024)).ok).toBe(false);
  });
});
