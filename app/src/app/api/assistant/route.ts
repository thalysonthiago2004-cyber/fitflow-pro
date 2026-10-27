import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth/dal";
import { parseHistory } from "@/lib/assistant/history";
import { AssistantRefused, assistantEnabled, runAssistant } from "@/lib/assistant/run";
import type { AssistantEvent } from "@/lib/assistant/types";
import { allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Chat endpoint: answers the last question of the posted history, streamed
// as NDJSON (one AssistantEvent per line). Nothing is stored server-side.

export const maxDuration = 60;

const UNAVAILABLE = "O assistente está indisponível no momento. Tente novamente em instantes.";

const fail = (status: number, message: string) => Response.json({ type: "error", message } satisfies AssistantEvent, { status });

function errorMessage(error: unknown): string {
  if (error instanceof AssistantRefused) return "Não posso ajudar com esse assunto. Para dúvidas de saúde, fale com seu personal ou um profissional de saúde.";
  if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
    return "O assistente está muito requisitado agora. Tente de novo em instantes.";
  }
  return UNAVAILABLE;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Sua sessão expirou. Entre novamente.");
  if (!assistantEnabled()) return fail(503, "O assistente ainda não foi ativado.");

  const history = parseHistory(await request.json().catch(() => null));
  if (!history.ok) return fail(400, history.message);

  const supabase = await createClient();
  // Each question is a paid call: refuse when the limit cannot be checked.
  if (!(await allow(supabase, "assistant", { failClosed: true }))) {
    return fail(429, "Você chegou ao limite de 30 perguntas por dia. O assistente volta amanhã.");
  }

  const role = user.workspace?.role === "student" || (!user.workspace && user.role === "student") ? "student" : "staff";
  const firstName = user.fullName.trim().split(/\s+/)[0]?.slice(0, 40) || "—";
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // After the browser disconnects the stream is closed; writes are dropped.
      const emit = (event: AssistantEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {}
      };
      try {
        const messages = await runAssistant({ role, userId: user.id, firstName, messages: history.messages, signal: request.signal, emit });
        emit({ type: "done", messages });
      } catch (error) {
        if (!request.signal.aborted) {
          if (!(error instanceof AssistantRefused)) console.error("assistant failed", error instanceof Anthropic.APIError ? `${error.status} ${error.name}` : error);
          emit({ type: "error", message: errorMessage(error) });
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
