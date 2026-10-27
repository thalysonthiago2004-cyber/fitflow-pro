import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { VideoSource } from "@/lib/workouts/video";

// Shared by the API route and the chat UI.

export type AssistantMessage = BetaMessageParam;

/** A demonstration video found by the assistant, resolved server-side from the caller's library. */
export type VideoCard = {
  exerciseId: string;
  name: string;
  /** Signed URL of a video the trainer uploaded (expires in 1 h). */
  videoSrc: string | null;
  videoUrl: string | null;
  source: VideoSource | "uploaded";
};

/** One line of the streamed (NDJSON) response. */
export type AssistantEvent =
  | { type: "text"; text: string }
  | { type: "videos"; videos: VideoCard[] }
  /** The turns to append to the history, exactly as the API returned them. */
  | { type: "done"; messages: AssistantMessage[] }
  /** The request is dropped: the client removes the question from the history. */
  | { type: "error"; message: string };

export const MAX_QUESTION_LENGTH = 2000;
