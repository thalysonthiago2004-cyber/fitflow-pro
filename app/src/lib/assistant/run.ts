import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, BetaToolResultBlockParam, BetaToolUseBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { type AssistantRole, systemPrompt } from "./prompt";
import { runTool, toolsFor } from "./tools";
import type { AssistantEvent, AssistantMessage } from "./types";

/** Model is configurable (ASSISTANT_MODEL); Claude Opus 5.5 by default. */
export const assistantModel = () => process.env.ASSISTANT_MODEL || "claude-opus-5-5";
export const assistantEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Models that accept the server-side refusal fallback ("default" routing).
const SERVER_FALLBACK = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

/** Tool rounds per question: enough to look up the plan and then the videos. */
const MAX_ROUNDS = 4;

export class AssistantRefused extends Error {}

type RunInput = {
  role: AssistantRole;
  userId: string;
  firstName: string;
  messages: AssistantMessage[];
  signal: AbortSignal;
  emit: (event: AssistantEvent) => void;
};

/**
 * Answers the last question of `messages`, streaming text and video cards
 * through `emit`. Returns the turns to append to the history, unchanged from
 * the API (thinking blocks must be sent back exactly as received).
 */
export async function runAssistant({ role, userId, firstName, messages, signal, emit }: RunInput): Promise<AssistantMessage[]> {
  const client = new Anthropic();
  const model = assistantModel();
  const system = systemPrompt(role, firstName);
  const tools = toolsFor(role);
  const appended: AssistantMessage[] = [];
  let wroteText = false;
  let jsonRetries = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 16000,
        system,
        tools,
        messages: [...messages, ...appended],
        thinking: { type: "adaptive" },
        // Conversational answers: low effort keeps them quick and cheap.
        output_config: { effort: "low" },
        ...(SERVER_FALLBACK.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { signal },
    );
    let startedRound = false;
    stream.on("text", (delta) => {
      // Separate text written before and after a tool call.
      if (!startedRound && wroteText) emit({ type: "text", text: "\n\n" });
      startedRound = wroteText = true;
      emit({ type: "text", text: delta });
    });

    let message: BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (error) {
      // Only an unparseable tool input (eager input streaming) is retried.
      if (error instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw error;
      round--;
      continue;
    }

    if (message.stop_reason === "refusal") throw new AssistantRefused();
    const toolUses = message.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
    appended.push({ role: "assistant", content: message.content });
    if (toolUses.length === 0) return appended;
    // A tool input cut off at max_tokens can still look valid: never run it.
    if (message.stop_reason === "max_tokens") throw new Error("Tool input truncated at max_tokens.");

    const results: BetaToolResultBlockParam[] = [];
    for (const tool of toolUses) {
      const outcome = await runTool(tool.name, tool.input, { role, userId }).catch(() => ({
        content: "The lookup failed. Tell the person to try again in a moment.",
        isError: true,
        videos: undefined,
      }));
      if (outcome.videos?.length) emit({ type: "videos", videos: outcome.videos });
      results.push({ type: "tool_result", tool_use_id: tool.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) });
    }
    appended.push({ role: "user", content: results });
  }

  // Out of tool rounds: close the turn with a plain answer.
  const closing = "Não consegui concluir a busca agora. Tente perguntar de outro jeito.";
  emit({ type: "text", text: (wroteText ? "\n\n" : "") + closing });
  appended.push({ role: "assistant", content: [{ type: "text", text: closing }] });
  return appended;
}
