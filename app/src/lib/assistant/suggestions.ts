import type { AssistantRole } from "./prompt";

// Starter questions shown in the chat and as shortcuts elsewhere in the app.
// Only these can be sent from a link (/assistant?q=…), so a crafted URL cannot
// spend someone's daily questions on text they did not choose.
export const SUGGESTIONS: Record<AssistantRole, readonly string[]> = {
  student: ["O que eu treino hoje?", "Como faço agachamento do jeito certo?", "Me mostra o vídeo do supino", "Quanto tempo devo descansar entre as séries?"],
  staff: ["Como convido um aluno?", "Como coloco um vídeo do TikTok em um exercício?", "Como monto um bi-set?", "Me mostra o vídeo do agachamento"],
};

export function linkedQuestion(role: AssistantRole, q: unknown): string | undefined {
  return typeof q === "string" && SUGGESTIONS[role].includes(q) ? q : undefined;
}
