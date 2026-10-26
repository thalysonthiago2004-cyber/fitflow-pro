import { describe, expect, it } from "vitest";
import { formatWhatsapp, normalizeWhatsapp, whatsappLink } from "./phone";

describe("normalizeWhatsapp", () => {
  it("accepts common Brazilian formats", () => {
    expect(normalizeWhatsapp("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizeWhatsapp("+55 21 3456-7890")).toBe("552134567890");
    expect(normalizeWhatsapp("11987654321")).toBe("5511987654321");
  });
  it("treats blank as none and rejects the rest", () => {
    expect(normalizeWhatsapp("  ")).toBeNull();
    expect(normalizeWhatsapp("12345")).toBe("invalid");
    expect(normalizeWhatsapp("(01) 98765-4321")).toBe("invalid");
  });
});

describe("formatting", () => {
  it("formats for display and builds the link", () => {
    expect(formatWhatsapp("5511987654321")).toBe("(11) 98765-4321");
    expect(whatsappLink("5511987654321", "Olá!")).toBe("https://wa.me/5511987654321?text=Ol%C3%A1!");
  });
});
