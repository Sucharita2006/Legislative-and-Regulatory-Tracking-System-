"use client";

import { useState } from "react";
import type { TrackedIssue } from "@/lib/tracked-issues-types";
import { KeyIssueTrackerClient } from "./key-issue-tracker-client";
import { TrackedIssuesClient } from "./tracked-issues-client";

type Tab = "ask" | "digests";

/** Switches the Key Issue Tracker between the live "Ask" tool and the
 *  "Digests" management view (scheduled email digests of tracked issues). */
export function TrackerTabs({
  issues,
  pendingRunId = null,
}: {
  issues: TrackedIssue[];
  /** An "Ask" run still pending server-side, for the client to re-attach to. */
  pendingRunId?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("ask");

  return (
    <div>
      <div className="flex gap-1 border-b border-white/10">
        <TabButton active={tab === "ask"} onClick={() => setTab("ask")}>
          Ask
        </TabButton>
        <TabButton active={tab === "digests"} onClick={() => setTab("digests")}>
          Digests
        </TabButton>
      </div>

      {tab === "ask" ? (
        <KeyIssueTrackerClient pendingRunId={pendingRunId} />
      ) : (
        <TrackedIssuesClient issues={issues} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
        active
          ? "border-teal text-white"
          : "border-transparent text-white/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
