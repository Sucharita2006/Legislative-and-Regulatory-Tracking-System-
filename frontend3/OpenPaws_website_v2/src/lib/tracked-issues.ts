import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TrackedIssue } from "@/lib/tracked-issues-types";

// Re-export the client-safe types/constants so existing imports keep working.
export {
  MAX_TRACKED_ISSUES,
  type Cadence,
  type TrackedIssue,
} from "@/lib/tracked-issues-types";

/** All of the current user's tracked issues, oldest first.
 *  Returns [] (rather than throwing) if the query fails — e.g. the
 *  tracked_issues table hasn't been migrated yet — so the page still renders
 *  and the "Ask" tab keeps working. */
export async function listTrackedIssues(): Promise<TrackedIssue[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tracked_issues")
    .select("id, title, prompt, cadence, active, last_sent_at, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load tracked issues:", error.message);
    return [];
  }
  return data ?? [];
}
