"use client";

import { CircleAlert, LoaderCircle, RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ExerciseVideo } from "@/components/workouts/exercise-demo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type AssistantEvent, type AssistantMessage, MAX_QUESTION_LENGTH, type VideoCard } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

type Turn = { id: string; role: "user" | "assistant"; text: string; videos: VideoCard[]; error?: string };
type Saved = { history: AssistantMessage[]; turns: Turn[] };

const SUGGESTIONS = {
  student: ["O que eu treino hoje?", "Como faço agachamento do jeito certo?", "Me mostra o vídeo do supino", "Quanto tempo devo descansar entre as séries?"],
  staff: ["Como convido um aluno?", "Como coloco um vídeo do TikTok em um exercício?", "Como monto um bi-set?", "Me mostra o vídeo do agachamento"],
} as const;

const UNAVAILABLE = "O assistente está indisponível no momento. Tente novamente em instantes.";

// The conversation lives in this tab only (sessionStorage): nothing is saved on the server.
function load(key: string): Saved {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null") as Saved | null;
    if (saved && Array.isArray(saved.history) && Array.isArray(saved.turns)) return saved;
  } catch {}
  return { history: [], turns: [] };
}

function save(key: string, value: Saved) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

type Props = { userId: string; role: "staff" | "student"; firstName: string };

export function AssistantChat({ userId, role, firstName }: Props) {
  const storageKey = `fitflow-assistant:${userId}`;
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = load(storageKey);
    setHistory(saved.history);
    setTurns(saved.turns);
    return () => abortRef.current?.abort();
  }, [storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  function update(id: string, change: (turn: Turn) => Turn) {
    setTurns((all) => all.map((t) => (t.id === id ? change(t) : t)));
  }

  async function ask(text: string) {
    const q = text.trim().slice(0, MAX_QUESTION_LENGTH);
    if (!q || pending) return;
    const answerId = crypto.randomUUID();
    const before = turns;
    const sent: AssistantMessage[] = [...history, { role: "user", content: q }];
    const asked: Turn = { id: crypto.randomUUID(), role: "user", text: q, videos: [] };
    setTurns([...turns, asked, { id: answerId, role: "assistant", text: "", videos: [] }]);
    setQuestion("");
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let answer: Turn = { id: answerId, role: "assistant", text: "", videos: [] };
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: sent }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("ndjson")) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? UNAVAILABLE);
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished: AssistantMessage[] | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AssistantEvent;
          if (event.type === "text") answer = { ...answer, text: answer.text + event.text };
          else if (event.type === "videos") answer = { ...answer, videos: [...answer.videos, ...event.videos.filter((v) => !answer.videos.some((a) => a.exerciseId === v.exerciseId))] };
          else if (event.type === "error") throw new Error(event.message);
          else if (event.type === "done") finished = event.messages;
          update(answerId, () => answer);
        }
      }
      if (!finished) throw new Error(UNAVAILABLE);
      const nextHistory = [...sent, ...finished];
      const nextTurns = [...before, asked, answer];
      setHistory(nextHistory);
      setTurns(nextTurns);
      save(storageKey, { history: nextHistory, turns: nextTurns });
    } catch (error) {
      if (controller.signal.aborted) return;
      // The question is not kept in the history: it can simply be asked again.
      update(answerId, (t) => ({ ...t, text: "", videos: [], error: error instanceof Error && error.message ? error.message : UNAVAILABLE }));
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(question);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setHistory([]);
    setTurns([]);
    setPending(false);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  }

  return (
    <div className="grid gap-4">
      <div role="log" aria-label="Conversa com o assistente" aria-busy={pending} className="grid gap-4">
        {turns.length === 0 ? (
          <div className="grid gap-4 rounded-xl border bg-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15">
                <Sparkles className="size-5 text-brand-foreground dark:text-brand" aria-hidden />
              </span>
              <div className="grid gap-1">
                <p className="font-heading font-semibold">Olá, {firstName}! Como posso ajudar?</p>
                <p className="text-sm text-muted-foreground">
                  {role === "student"
                    ? "Pergunte sobre o seu treino, a execução dos exercícios ou peça o vídeo de um exercício."
                    : "Pergunte como usar o FitFlow, tire dúvidas de treino ou peça o vídeo de um exercício da sua biblioteca."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[role].map((s) => (
                <Button key={s} type="button" variant="outline" size="sm" className="h-auto min-h-11 rounded-full px-4 py-2 text-left whitespace-normal" onClick={() => void ask(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) =>
            turn.role === "user" ? (
              <div key={turn.id} className="max-w-[85%] justify-self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-line text-primary-foreground">
                <span className="sr-only">Você: </span>
                {turn.text}
              </div>
            ) : (
              <div key={turn.id} className="grid max-w-[95%] gap-3 justify-self-start">
                <span className="sr-only">Assistente: </span>
                {turn.error ? (
                  <p className="flex items-start gap-2 rounded-xl border border-destructive/40 px-4 py-3 text-sm text-destructive">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {turn.error}
                  </p>
                ) : turn.text ? (
                  <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-sm leading-relaxed whitespace-pre-line">{turn.text}</div>
                ) : (
                  <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    Pensando…
                  </p>
                )}
                {turn.videos.length > 0 && (
                  <ul className="grid gap-3 sm:grid-cols-2" aria-label="Vídeos encontrados">
                    {turn.videos.map((v) => (
                      <li key={v.exerciseId} className="grid gap-2 rounded-xl border bg-card p-3">
                        <p className="text-sm font-semibold">{v.name}</p>
                        <ExerciseVideo name={v.name} videoUrl={v.videoUrl} videoSrc={v.videoSrc} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="grid gap-2">
        <label htmlFor="assistant-question" className="sr-only">
          Sua pergunta
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id="assistant-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_QUESTION_LENGTH}
            rows={2}
            placeholder="Escreva sua pergunta…"
            className="min-h-12 resize-none text-base"
          />
          <Button type="submit" size="icon" className="size-12 shrink-0" disabled={pending || !question.trim()} aria-busy={pending || undefined}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <SendHorizontal aria-hidden />}
            <span className="sr-only">Enviar</span>
          </Button>
        </div>
        <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", turns.length > 0 ? "justify-between" : "justify-start")}>
          <p className="text-xs text-muted-foreground">O assistente pode errar e não substitui seu personal nem orientação médica.</p>
          {turns.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="min-h-11">
              <RotateCcw aria-hidden />
              Nova conversa
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
