import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTool } from "@/lib/auth";
import { listToolRuns } from "@/lib/tool-runs";
import { ResearchClient } from "./research-client";

export const metadata: Metadata = {
  title: "Legal Research",
  description:
    "Research animal-related law and policy with an AI that searches legal databases.",
};

export default async function LegalResearchPage() {
  // Tool access is per-user, admin-controlled; hiding the nav isn't enough.
  if (!(await canUseTool("legal-research"))) redirect("/tools");

  // A run that's still working server-side (e.g. the page was reloaded while
  // it ran) — the client re-attaches to it so progress isn't lost.
  const pending =
    (await listToolRuns("legal-research", 5)).find((r) => r.status === "pending") ??
    null;

  return (
    <ResearchClient
      pendingRun={
        pending
          ? { id: pending.id, label: String(pending.input?.prompt ?? "") }
          : null
      }
    />
  );
}
