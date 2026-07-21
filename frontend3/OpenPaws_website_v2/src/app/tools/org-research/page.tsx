import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTool } from "@/lib/auth";
import { listToolRuns } from "@/lib/tool-runs";
import { ResearchClient } from "./research-client";

export const metadata: Metadata = {
  title: "Organization Research",
  description:
    "Gather open-source intelligence on a company — structure, key people, recent news, and other public data.",
};

export default async function OrgResearchPage() {
  // Tool access is per-user, admin-controlled; hiding the nav isn't enough.
  if (!(await canUseTool("org-research"))) redirect("/tools");

  // A run that's still working server-side (e.g. the page was reloaded while
  // it ran) — the client re-attaches to it so progress isn't lost.
  const pending =
    (await listToolRuns("org-research", 5)).find((r) => r.status === "pending") ??
    null;

  return (
    <ResearchClient
      pendingRun={
        pending
          ? { id: pending.id, label: String(pending.input?.companyName ?? "") }
          : null
      }
    />
  );
}
