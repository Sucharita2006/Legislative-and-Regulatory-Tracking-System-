import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTool } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { TrackerTabs } from "./tracker-tabs";
import type { UserProfile } from "./types";

export const metadata: Metadata = {
  title: "Legislative Tracker",
  description:
    "Track animal welfare and protection legislation with an AI that searches across databases.",
};

export default async function LegislativeTrackerPage() {
  // Tool access is per-user, admin-controlled; hiding the nav isn't enough.
  if (!(await canUseTool("legislative-tracker"))) redirect("/tools");

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) redirect("/tools-for-advocates");

  const { data: supabaseProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", authUser.id)
    .maybeSingle();

  let userProfile: UserProfile | null = null;
  try {
    const res = await apiFetch(
      `/users/${encodeURIComponent(authUser.email)}`,
      authUser.email,
    );
    if (res.ok) {
      userProfile = (await res.json()) as UserProfile;
    }
  } catch {
    /* use fallback */
  }

  const user: UserProfile = {
    ...(userProfile ?? {
      id: authUser.id,
      email: authUser.email,
      full_name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
      scope: "federal",
      review_bills: [],
      prompts: [],
      is_verified: !!authUser.email_confirmed_at,
    }),
    is_admin: supabaseProfile?.is_admin === true,
  };

  return <TrackerTabs user={user} />;
}
