import "server-only";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";

// Student-only pages; trainers are sent to their plan management area.
export async function requireStudent() {
  const user = await requireUser();
  if (user.role !== "student") redirect("/workouts");
  return user;
}
