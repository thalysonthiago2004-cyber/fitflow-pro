/** Lowercase without accents, for forgiving search ("Joao" finds "João"). */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
