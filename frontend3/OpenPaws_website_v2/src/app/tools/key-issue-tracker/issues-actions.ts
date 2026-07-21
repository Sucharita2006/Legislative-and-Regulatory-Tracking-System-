"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";
import { MAX_TRACKED_ISSUES, type Cadence } from "@/lib/tracked-issues-types";

export type IssueActionState = { error?: string; message?: string } | null;

const TRACKER_PATH = "/tools/key-issue-tracker";

function parseCadence(value: FormDataEntryValue | null): Cadence {
  return value === "daily" ? "daily" : "weekly";
}

/** Resolve the signed-in user with tracker access — or an error for the form. */
async function requireApprovedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." as const };
  if (!(await canUseTool("key-issue-tracker"))) {
    return { error: "You don't have access to this tool." as const };
  }
  return { supabase, user };
}

export async function createTrackedIssue(
  _prev: IssueActionState,
  formData: FormData,
): Promise<IssueActionState> {
  const ctx = await requireApprovedUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const cadence = parseCadence(formData.get("cadence"));
  if (!title) return { error: "Pick at least one topic." };
  if (!prompt) return { error: "A research prompt is required." };

  // Friendly pre-check; the DB trigger is the real guard against races.
  const { count } = await supabase
    .from("tracked_issues")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_TRACKED_ISSUES) {
    return { error: `You can track at most ${MAX_TRACKED_ISSUES} issues.` };
  }

  const { error } = await supabase
    .from("tracked_issues")
    .insert({ user_id: user.id, title, prompt, cadence });
  if (error) {
    // The limit trigger raises a check_violation when the cap is hit.
    if (error.code === "23514") {
      return { error: `You can track at most ${MAX_TRACKED_ISSUES} issues.` };
    }
    return { error: "Could not save the issue. Please try again." };
  }

  revalidatePath(TRACKER_PATH);
  return { message: "Issue added." };
}

export async function updateTrackedIssue(
  _prev: IssueActionState,
  formData: FormData,
): Promise<IssueActionState> {
  const ctx = await requireApprovedUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing issue id." };

  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const cadence = parseCadence(formData.get("cadence"));
  const active = formData.get("active") !== null;
  if (!title) return { error: "Pick at least one topic." };
  if (!prompt) return { error: "A research prompt is required." };

  // RLS scopes the update to the owner's row, so no user_id filter is needed.
  const { error } = await supabase
    .from("tracked_issues")
    .update({ title, prompt, cadence, active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not update the issue. Please try again." };

  revalidatePath(TRACKER_PATH);
  return { message: "Issue updated." };
}

export async function deleteTrackedIssue(formData: FormData): Promise<void> {
  const ctx = await requireApprovedUser();
  if ("error" in ctx) return;
  const { supabase } = ctx;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // RLS ensures a user can only delete their own row.
  await supabase.from("tracked_issues").delete().eq("id", id);
  revalidatePath(TRACKER_PATH);
}
