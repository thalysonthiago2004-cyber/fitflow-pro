// Brazilian phone numbers for WhatsApp links: accepts "(11) 98765-4321",
// "11987654321" or "+55 11 98765-4321" and stores "5511987654321".

export function normalizeWhatsapp(input: string): string | null | "invalid" {
  const digits = input.replace(/\D/g, "");
  if (digits === "") return null;
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (!/^[1-9][0-9]9?[0-9]{8}$/.test(national)) return "invalid";
  return `55${national}`;
}

/** "(11) 98765-4321" for display. */
export function formatWhatsapp(stored: string): string {
  const n = stored.slice(2);
  const area = n.slice(0, 2);
  const rest = n.slice(2);
  return `(${area}) ${rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`}`;
}

export function whatsappLink(stored: string, message: string): string {
  return `https://wa.me/${stored}?text=${encodeURIComponent(message)}`;
}
