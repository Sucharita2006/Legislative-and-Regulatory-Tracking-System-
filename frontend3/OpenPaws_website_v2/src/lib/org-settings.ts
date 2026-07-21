import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Per-user organization settings (profiles.organization / .custom_prompt),
 * edited on /tools/settings and forwarded to every n8n workflow the tools
 * trigger so outputs can be tailored to the user's org.
 *
 * Kept separate from getAccessProfile on purpose: access checks must keep
 * working even if the org-settings migration hasn't been run yet, so this
 * reader degrades to empty strings on any error instead of failing the caller.
 */
export type OrgSettings = {
  organization: string;
  customPrompt: string;
};

const EMPTY: OrgSettings = { organization: "", customPrompt: "" };

/** The signed-in user's org settings; empty strings when signed out or unset. */
export async function getOrgSettings(): Promise<OrgSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const { data, error } = await supabase
    .from("profiles")
    .select("organization, custom_prompt")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return EMPTY; // e.g. columns not migrated yet

  return {
    organization:
      typeof data.organization === "string" ? data.organization.trim() : "",
    customPrompt:
      typeof data.custom_prompt === "string" ? data.custom_prompt.trim() : "",
  };
}

/**
 * The full profile as shown on /tools/settings: the webhook-forwarded org
 * settings plus the about-me fields collected at signup (org description,
 * role), which the user can revise there.
 */
export type ProfileSettings = OrgSettings & {
  orgDescription: string;
  orgRole: string;
};

const EMPTY_PROFILE: ProfileSettings = {
  ...EMPTY,
  orgDescription: "",
  orgRole: "",
};

/** The signed-in user's profile settings; empty strings when signed out or unset. */
export async function getProfileSettings(): Promise<ProfileSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_PROFILE;

  const { data, error } = await supabase
    .from("profiles")
    .select("organization, custom_prompt, org_description, org_role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return EMPTY_PROFILE; // e.g. columns not migrated yet

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    organization: str(data.organization),
    customPrompt: str(data.custom_prompt),
    orgDescription: str(data.org_description),
    orgRole: str(data.org_role),
  };
}

/**
 * The org settings as n8n webhook payload fields. Empty values are omitted so
 * workflows can use a simple "field present?" check, and payloads for users
 * who never touched the settings look exactly like they did before.
 */
export function orgWebhookFields(
  settings: OrgSettings,
): Partial<Record<"organization" | "customPrompt", string>> {
  return {
    ...(settings.organization ? { organization: settings.organization } : {}),
    ...(settings.customPrompt ? { customPrompt: settings.customPrompt } : {}),
  };
}
