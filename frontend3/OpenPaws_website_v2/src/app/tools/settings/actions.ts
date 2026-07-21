"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isApproved } from "@/lib/auth";

export type SettingsState = { error: string } | { message: string } | null;

const MAX_ORGANIZATION = 200;
const MAX_CUSTOM_PROMPT = 4000;
const MAX_ORG_DESCRIPTION = 1000;
const MAX_ORG_ROLE = 200;

/**
 * Save the user's profile: organization + custom prompt (forwarded to the n8n
 * workflows) and the about-me fields from signup (org description, role).
 * Profiles has no user-facing update policy (so `approved` / `is_admin` can't
 * be tampered with from the browser), so after verifying the session we write
 * just these columns with the service role — same pattern as hideToolRun.
 */
export async function saveOrgSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Please sign in to save your settings." };
  }
  if (!(await isApproved())) {
    return { error: "Your account is awaiting approval." };
  }

  const organization = String(formData.get("organization") ?? "").trim();
  const customPrompt = String(formData.get("customPrompt") ?? "").trim();
  const orgDescription = String(formData.get("orgDescription") ?? "").trim();
  const orgRole = String(formData.get("orgRole") ?? "").trim();

  if (organization.length > MAX_ORGANIZATION) {
    return {
      error: `Organization name must be under ${MAX_ORGANIZATION} characters.`,
    };
  }
  if (customPrompt.length > MAX_CUSTOM_PROMPT) {
    return {
      error: `Custom prompt must be under ${MAX_CUSTOM_PROMPT} characters.`,
    };
  }
  if (orgDescription.length > MAX_ORG_DESCRIPTION) {
    return {
      error: `The organization description must be under ${MAX_ORG_DESCRIPTION} characters.`,
    };
  }
  if (orgRole.length > MAX_ORG_ROLE) {
    return { error: `Your role must be under ${MAX_ORG_ROLE} characters.` };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      organization,
      custom_prompt: customPrompt,
      org_description: orgDescription,
      org_role: orgRole,
    })
    .eq("id", user.id);
  if (error) {
    console.error("Saving org settings failed:", error);
    return { error: "Couldn't save your settings. Please try again." };
  }

  revalidatePath("/tools/settings");
  return { message: "Saved. Your tools will now include this context." };
}
