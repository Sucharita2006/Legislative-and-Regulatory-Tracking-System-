import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTool } from "@/lib/auth";
import { listTrackedIssues } from "@/lib/tracked-issues";
import { listToolRuns } from "@/lib/tool-runs";
import { TrackerTabs } from "./tracker-tabs";

export const metadata: Metadata = {
  title: "Key Issue Tracker",
  description:
    "Track key animal advocacy issues with an AI that searches across sources.",
};

export default async function KeyIssueTrackerPage() {
  // Tool access is per-user, admin-controlled; hiding the nav isn't enough.
  if (!(await canUseTool("key-issue-tracker"))) redirect("/tools");
  const issues = await listTrackedIssues();

  // An "Ask" run still working server-side (e.g. the page was reloaded while
  // it ran) — the client re-attaches to it so progress isn't lost.
  const pending =
    (await listToolRuns("key-issue-tracker", 5)).find(
      (r) => r.status === "pending",
    ) ?? null;

  return <TrackerTabs issues={issues} pendingRunId={pending?.id ?? null} />;
}
