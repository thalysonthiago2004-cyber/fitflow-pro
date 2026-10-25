import "server-only";

import type { PhotoPose } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type ProgressPhoto = { id: string; takenOn: string; pose: PhotoPose; url: string };

/** Oldest first, with short-lived signed URLs. RLS limits rows and files to the student and their staff. */
export async function listProgressPhotos(studentId: string): Promise<ProgressPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("progress_photos")
    .select("id, taken_on, pose, storage_path")
    .eq("student_id", studentId)
    .order("taken_on", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load progress photos: ${error.message}`);
  if (data.length === 0) return [];

  const { data: signed, error: signError } = await supabase.storage
    .from("progress-photos")
    .createSignedUrls(data.map((p) => p.storage_path), 60 * 60);
  if (signError) throw new Error(`Failed to sign progress photos: ${signError.message}`);
  const urlByPath = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  return data.flatMap((p) => {
    const url = urlByPath.get(p.storage_path);
    return url ? [{ id: p.id, takenOn: p.taken_on, pose: p.pose, url }] : [];
  });
}
