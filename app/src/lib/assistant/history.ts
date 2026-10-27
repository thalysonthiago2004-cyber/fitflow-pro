import { z } from "zod";
import { type AssistantMessage, MAX_QUESTION_LENGTH } from "./types";

// The browser keeps the conversation and sends it back each turn, because
// the API needs earlier assistant turns (thinking blocks included) exactly as
// it returned them. That history is untrusted: it may only contain what this
// route produced, and it can never carry operator ("system") instructions.

export const MAX_MESSAGES = 40;
export const MAX_HISTORY_BYTES = 200_000;

const ASSISTANT_BLOCKS = ["text", "thinking", "redacted_thinking", "tool_use", "fallback"] as const;

const assistantMessage = z.object({
  role: z.literal("assistant"),
  content: z.array(z.looseObject({ type: z.enum(ASSISTANT_BLOCKS) })).min(1),
});

const toolResults = z.object({
  role: z.literal("user"),
  content: z
    .array(z.object({ type: z.literal("tool_result"), tool_use_id: z.string().max(200), content: z.string().max(20_000), is_error: z.boolean().optional() }))
    .min(1),
});

const question = z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(MAX_QUESTION_LENGTH) });

const history = z.array(z.union([question, toolResults, assistantMessage])).min(1).max(MAX_MESSAGES);

export type HistoryResult = { ok: true; messages: AssistantMessage[] } | { ok: false; message: string };

export function parseHistory(body: unknown): HistoryResult {
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (JSON.stringify(messages ?? null).length > MAX_HISTORY_BYTES) {
    return { ok: false, message: "A conversa ficou longa demais. Comece uma nova conversa." };
  }
  const parsed = history.safeParse(messages);
  if (!parsed.success) return { ok: false, message: "Não foi possível ler a conversa. Comece uma nova conversa." };
  const list = parsed.data;
  // Starts with a question and ends with the new one.
  if (typeof list[0].content !== "string" || list.at(-1)!.role !== "user" || typeof list.at(-1)!.content !== "string") {
    return { ok: false, message: "Não foi possível ler a conversa. Comece uma nova conversa." };
  }
  return { ok: true, messages: list as AssistantMessage[] };
}
