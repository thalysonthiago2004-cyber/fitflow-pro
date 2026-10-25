import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type OrderedTable = "workout_sessions" | "session_exercises" | "meals" | "meal_items";
type Orderable = { id: string; position: number };

/** Moves one item up or down and rewrites positions as 0..n-1. RLS still applies to every update. */
export async function moveInList(
  supabase: Client,
  table: OrderedTable,
  items: Orderable[],
  itemId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const index = items.findIndex((item) => item.id === itemId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) return false;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];

  const changed = next.map((item, position) => ({ id: item.id, position, before: item.position })).filter((i) => i.before !== i.position);
  const results = await Promise.all(changed.map((item) => supabase.from(table).update({ position: item.position }).eq("id", item.id)));
  return results.every((result) => !result.error);
}
