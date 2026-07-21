import type { Metadata } from "next";
import { Heading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getProfileSettings } from "@/lib/org-settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Edit your organization details and the custom prompt included with every tool run.",
};

// The form must always show what's currently saved; never serve a cached copy.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // The tools layout has already verified the user is signed in and approved.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const settings = await getProfileSettings();

  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Your <span className="italic">profile</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-white/60">
        Signed in as{" "}
        <span className="font-mono text-white/80">{user?.email}</span>. Tell the
        tools who you advocate with — your organization details and custom
        prompt are included with every request, so the results fit your
        org&apos;s context and voice.
      </p>

      <div className="mt-8">
        <SettingsForm
          organization={settings.organization}
          customPrompt={settings.customPrompt}
          orgDescription={settings.orgDescription}
          orgRole={settings.orgRole}
        />
      </div>
    </div>
  );
}
