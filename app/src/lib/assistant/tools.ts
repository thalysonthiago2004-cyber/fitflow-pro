import "server-only";

import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { formatReps, formatWeekdays } from "@/lib/workouts/labels";
import { type Exercise, findExercisesWithVideo, getStudentPlans } from "@/lib/workouts/queries";
import { videoSource } from "@/lib/workouts/video";
import type { AssistantRole } from "./prompt";
import type { VideoCard } from "./types";

// Tools read with the caller's session, so RLS limits them to what the person
// can already see in the app. Results go to the model as JSON; video cards go
// to the UI from the server's own data, never from model output.

const findVideos: BetaTool = {
  name: "find_exercise_videos",
  description:
    "Search this person's FitFlow exercise library for demonstration videos by exercise name (Portuguese, e.g. \"agachamento\", \"supino reto\"). Returns at most 5 exercises that have a video. The app shows them to the person as video cards.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Exercise name or part of it, in Portuguese." } },
    required: ["query"],
  },
  eager_input_streaming: true,
};

const myPlan: BetaTool = {
  name: "get_my_workout_plan",
  description:
    "The signed-in student's published workout plans: sessions with their weekdays and exercises (sets, reps, rest, load, cardio targets, trainer notes) and whether each exercise has a video.",
  input_schema: { type: "object", properties: {} },
  eager_input_streaming: true,
};

export function toolsFor(role: AssistantRole): BetaTool[] {
  return role === "student" ? [findVideos, myPlan] : [findVideos];
}

export type ToolOutcome = { content: string; isError?: boolean; videos?: VideoCard[] };

const findInput = z.object({ query: z.string().trim().min(2).max(120) });

function toCard(e: Exercise): VideoCard {
  return {
    exerciseId: e.id,
    name: e.name,
    videoSrc: e.videoSrc,
    videoUrl: e.videoUrl,
    source: e.videoSrc ? "uploaded" : videoSource(e.videoUrl ?? ""),
  };
}

async function runFindVideos(input: unknown): Promise<ToolOutcome> {
  const parsed = findInput.safeParse(input);
  if (!parsed.success) return { content: "Invalid input: send a short exercise name as `query`.", isError: true };
  const found = await findExercisesWithVideo(parsed.data.query);
  const videos = found.map(toCard).filter((v) => v.videoSrc || v.videoUrl);
  return {
    content: JSON.stringify(
      videos.length
        ? { found: videos.map((v) => ({ exercise: v.name, video: v.source === "uploaded" ? "video uploaded by the trainer" : v.source })) }
        : { found: [], note: "No video registered for this exercise in the library." },
    ),
    videos,
  };
}

async function runMyPlan(userId: string): Promise<ToolOutcome> {
  const plans = await getStudentPlans(userId);
  if (plans.length === 0) return { content: JSON.stringify({ plans: [], note: "No published plan yet: the trainer has not published one." }) };
  return {
    content: JSON.stringify({
      plans: plans.map((plan) => ({
        name: plan.name,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        sessions: plan.sessions.map((s) => ({
          name: s.name,
          weekdays: formatWeekdays(s.weekdays),
          exercises: s.exercises.map((p) => ({
            name: p.exercise.name,
            hasVideo: Boolean(p.exercise.videoUrl || p.exercise.videoSrc),
            notes: p.notes,
            ...(p.kind === "strength"
              ? {
                  sets: p.sets,
                  reps: p.repsPerSet?.join("/") ?? formatReps(p.repsMin, p.repsMax),
                  loadKg: p.loadKg,
                  restSeconds: p.restSeconds,
                  supersetGroup: p.supersetGroup,
                }
              : { cardio: p.cardio }),
          })),
        })),
      })),
    }),
  };
}

export async function runTool(name: string, input: unknown, ctx: { role: AssistantRole; userId: string }): Promise<ToolOutcome> {
  if (name === "find_exercise_videos") return runFindVideos(input);
  if (name === "get_my_workout_plan" && ctx.role === "student") return runMyPlan(ctx.userId);
  return { content: `Unknown tool: ${name}`, isError: true };
}
