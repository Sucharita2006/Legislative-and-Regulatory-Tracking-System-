"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser, isApproved } from "@/lib/auth";
import { MAX_TRACKED_LEGISLATIONS, type Cadence } from "@/lib/tracked-legislations-types";

export type LegislativeActionState = { error?: string; message?: string } | null;

const TRACKER_PATH = "/tools/legislative-tracker";
const LEGISLATIVE_PREFIX = "[Legislative] ";

function parseCadence(value: FormDataEntryValue | null): Cadence {
  return value === "daily" ? "daily" : "weekly";
}

async function requireApprovedUser() {
  const user = await getUser();
  if (!user) return { error: "Not authenticated." as const };
  if (!(await isApproved())) return { error: "Your account is awaiting approval." as const };
  const supabase = await createClient();
  return { supabase, user };
}

export async function createTrackedLegislation(
  _prev: LegislativeActionState,
  formData: FormData,
): Promise<LegislativeActionState> {
  const ctx = await requireApprovedUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const rawTitle = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const cadence = parseCadence(formData.get("cadence"));
  if (!rawTitle) return { error: "Pick at least one topic." };
  if (!prompt) return { error: "A research prompt is required." };

  const title = LEGISLATIVE_PREFIX + rawTitle;

  // Query database to check count for this user
  const { data: existingIssues, error: countError } = await supabase
    .from("tracked_issues")
    .select("title");
  
  if (countError) {
    return { error: "Could not verify tracking limits." };
  }

  const existingLegislationCount = (existingIssues ?? []).filter(issue => issue.title.startsWith(LEGISLATIVE_PREFIX)).length;

  if (existingLegislationCount >= MAX_TRACKED_LEGISLATIONS) {
    return { error: `You can track at most ${MAX_TRACKED_LEGISLATIONS} bills.` };
  }

  const { error } = await supabase
    .from("tracked_issues")
    .insert({ user_id: user.id, title, prompt, cadence });
  if (error) {
    if (error.code === "23514") {
      return { error: `You can track at most ${MAX_TRACKED_LEGISLATIONS} bills.` };
    }
    return { error: "Could not save the bill. Please try again." };
  }

  revalidatePath(TRACKER_PATH);
  return { message: "Bill added." };
}

export async function updateTrackedLegislation(
  _prev: LegislativeActionState,
  formData: FormData,
): Promise<LegislativeActionState> {
  const ctx = await requireApprovedUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing bill id." };

  const rawTitle = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const cadence = parseCadence(formData.get("cadence"));
  const active = formData.get("active") !== null;
  if (!rawTitle) return { error: "Pick at least one topic." };
  if (!prompt) return { error: "A research prompt is required." };

  const title = LEGISLATIVE_PREFIX + rawTitle;

  const { error } = await supabase
    .from("tracked_issues")
    .update({ title, prompt, cadence, active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not update the bill. Please try again." };

  revalidatePath(TRACKER_PATH);
  return { message: "Bill updated." };
}

export async function deleteTrackedLegislation(formData: FormData): Promise<void> {
  const ctx = await requireApprovedUser();
  if ("error" in ctx) return;
  const { supabase } = ctx;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("tracked_issues").delete().eq("id", id);
  revalidatePath(TRACKER_PATH);
}
