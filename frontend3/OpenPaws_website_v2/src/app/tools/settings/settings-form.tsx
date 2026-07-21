"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { saveOrgSettings, type SettingsState } from "./actions";

export function SettingsForm({
  organization,
  customPrompt,
  orgDescription,
  orgRole,
}: {
  organization: string;
  customPrompt: string;
  orgDescription: string;
  orgRole: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveOrgSettings,
    null,
  );

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.02] p-8">
      <form action={formAction} className="space-y-6">
        <label className="block">
          <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.15em] text-white/60">
            Your organization
          </span>
          <input
            type="text"
            name="organization"
            defaultValue={organization}
            maxLength={200}
            placeholder="e.g. Compassion in World Farming"
            className="w-full rounded-lg border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.15em] text-white/60">
            About your organization
          </span>
          <textarea
            name="orgDescription"
            defaultValue={orgDescription}
            rows={3}
            maxLength={1000}
            placeholder="What does your organization work on?"
            className="w-full resize-y rounded-lg border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.15em] text-white/60">
            Your role
          </span>
          <input
            type="text"
            name="orgRole"
            defaultValue={orgRole}
            maxLength={200}
            autoComplete="organization-title"
            placeholder="e.g. Campaign manager, volunteer, researcher"
            className="w-full rounded-lg border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.15em] text-white/60">
            Custom prompt
          </span>
          <textarea
            name="customPrompt"
            defaultValue={customPrompt}
            rows={8}
            maxLength={4000}
            placeholder={
              "Standing instructions included with every tool run — e.g. your organization's mission, campaigns, tone of voice, and the audience you write for."
            }
            className="min-h-[12rem] w-full resize-y rounded-lg border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
          />
          <span className="mt-1.5 block text-xs text-white/40">
            Sent along with your requests to every tool, so results are tailored
            to your organization. Leave blank to opt out.
          </span>
        </label>

        {state && "error" in state && (
          <p className="font-mono text-xs text-coral" role="alert">
            {state.error}
          </p>
        )}
        {state && "message" in state && (
          <p className="font-mono text-xs text-teal" role="status">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
