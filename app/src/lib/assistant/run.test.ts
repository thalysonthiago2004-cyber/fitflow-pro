import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// A scripted stand-in for the Anthropic client: each call to stream() plays
// the next response and records the request it received.
const script: Array<{ content: unknown[]; stop_reason: string }> = [];
const requests: Array<Record<string, unknown>> = [];

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Anthropic {
    static APIError = APIError;
    beta = {
      messages: {
        stream: (params: Record<string, unknown>) => {
          requests.push(structuredClone(params));
          const next = script.shift()!;
          let onText: ((d: string) => void) | undefined;
          return {
            on(event: string, cb: (d: string) => void) {
              if (event === "text") onText = cb;
              return this;
            },
            async finalMessage() {
              for (const b of next.content as Array<{ type: string; text?: string }>) if (b.type === "text") onText?.(b.text!);
              return next;
            },
          };
        },
      },
    };
  }
  return { default: Anthropic };
});

const findExercisesWithVideo = vi.fn();
const getStudentPlans = vi.fn();
vi.mock("@/lib/workouts/queries", () => ({ findExercisesWithVideo: (...a: unknown[]) => findExercisesWithVideo(...a), getStudentPlans: (...a: unknown[]) => getStudentPlans(...a) }));

const { runAssistant, AssistantRefused } = await import("./run");

const thinking = { type: "thinking", thinking: "", signature: "sig-1" };
const squat = { id: "ex1", name: "Agachamento livre", videoUrl: "https://www.tiktok.com/@p/video/1", videoSrc: null, videoPath: null };

function run(role: "staff" | "student" = "student") {
  const events: unknown[] = [];
  const result = runAssistant({
    role,
    userId: "u1",
    firstName: "Carla",
    messages: [{ role: "user", content: "Me mostra o agachamento" }],
    signal: new AbortController().signal,
    emit: (e) => events.push(e),
  });
  return { result, events };
}

beforeEach(() => {
  script.length = 0;
  requests.length = 0;
  vi.stubEnv("ASSISTANT_MODEL", "");
  findExercisesWithVideo.mockResolvedValue([squat]);
});

describe("runAssistant", () => {
  it("looks up videos, streams the answer and returns the turns unchanged", async () => {
    const toolTurn = [thinking, { type: "tool_use", id: "t1", name: "find_exercise_videos", input: { query: "agachamento" } }];
    script.push({ content: toolTurn, stop_reason: "tool_use" }, { content: [{ type: "text", text: "Veja o vídeo abaixo." }], stop_reason: "end_turn" });
    const { result, events } = run();
    const turns = await result;

    expect(findExercisesWithVideo).toHaveBeenCalledWith("agachamento");
    expect(events).toContainEqual({ type: "videos", videos: [{ exerciseId: "ex1", name: "Agachamento livre", videoSrc: null, videoUrl: squat.videoUrl, source: "tiktok" }] });
    expect(events).toContainEqual({ type: "text", text: "Veja o vídeo abaixo." });
    expect(turns[0]).toEqual({ role: "assistant", content: toolTurn });
    expect(turns[1]).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1" }] });
    expect(turns).toHaveLength(3);

    // Defaults: Opus 5.5, adaptive thinking, low effort, server-side fallback.
    expect(requests[0]).toMatchObject({ model: "claude-opus-5-5", thinking: { type: "adaptive" }, output_config: { effort: "low" }, fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
    // The second call carries the first turn back exactly as received.
    expect((requests[1].messages as unknown[])[1]).toEqual({ role: "assistant", content: toolTurn });
  });

  it("only gives students the plan tool", async () => {
    script.push({ content: [{ type: "tool_use", id: "t1", name: "get_my_workout_plan", input: {} }], stop_reason: "tool_use" }, { content: [{ type: "text", text: "Não tenho acesso." }], stop_reason: "end_turn" });
    const turns = await run("staff").result;
    expect((requests[0].tools as Array<{ name: string }>).map((t) => t.name)).toEqual(["find_exercise_videos"]);
    expect(getStudentPlans).not.toHaveBeenCalled();
    expect(turns[1]).toMatchObject({ content: [{ is_error: true }] });
  });

  it("refuses without returning turns, and stops after a few tool rounds", async () => {
    script.push({ content: [], stop_reason: "refusal" });
    await expect(run().result).rejects.toBeInstanceOf(AssistantRefused);

    for (let i = 0; i < 4; i++) script.push({ content: [{ type: "tool_use", id: `t${i}`, name: "find_exercise_videos", input: { query: "supino" } }], stop_reason: "tool_use" });
    const turns = await run().result;
    expect(requests).toHaveLength(5);
    expect(turns.at(-1)).toEqual({ role: "assistant", content: [{ type: "text", text: "Não consegui concluir a busca agora. Tente perguntar de outro jeito." }] });
  });

  it("skips the server-side fallback on models without it", async () => {
    vi.stubEnv("ASSISTANT_MODEL", "claude-haiku-5-5");
    script.push({ content: [{ type: "text", text: "Oi" }], stop_reason: "end_turn" });
    await run().result;
    expect(requests[0].model).toBe("claude-haiku-5-5");
    expect(requests[0]).not.toHaveProperty("fallbacks");
  });
});
