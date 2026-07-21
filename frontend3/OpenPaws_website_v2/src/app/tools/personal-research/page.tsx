import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTool } from "@/lib/auth";
import { listToolRuns } from "@/lib/tool-runs";
import { ResearchClient } from "./research-client";

export const metadata: Metadata = {
  title: "Personal Research",
  description:
    "Build a research profile of a person from their LinkedIn and company — background, role, and public information.",
};

export default async function PersonalResearchPage() {
  // Tool access is per-user, admin-controlled; hiding the nav isn't enough.
  if (!(await canUseTool("personal-research"))) redirect("/tools");

  // A run that's still working server-side (e.g. the page was reloaded while
  // it ran) — the client re-attaches to it so progress isn't lost.
  const pending =
    (await listToolRuns("personal-research", 5)).find(
      (r) => r.status === "pending",
    ) ?? null;

  return (
    <ResearchClient
      pendingRun={
        pending
          ? {
              id: pending.id,
              label: `${pending.input?.firstName ?? ""} ${pending.input?.lastName ?? ""}`.trim(),
            }
          : null
      }
    />
  );
}
