"use client";

import { useRef, useState } from "react";
import { YesterdayTab } from "./yesterday-tab";
import { AskTab } from "./ask-tab";
import { PreferencesTab } from "./preferences-tab";
import { TrackedTab } from "./tracked-tab";
import type { UserProfile } from "./types";

type Tab = "yesterday" | "ask" | "tracked" | "preferences";

const TAB_LABELS: Record<Tab, string> = {
  yesterday: "Yesterday",
  ask: "Search bills",
  tracked: "Tracked",
  preferences: "Email digest",
};

export function TrackerTabs({ user }: { user: UserProfile }) {
  const [tab, setTab] = useState<Tab>("yesterday");
  // Tracked-bill state lives here, shared across tabs, so tracking a bill in
  // the Yesterday/Ask tabs and viewing/untracking it in the Tracked tab all
  // stay in sync without each tab re-fetching the user's whole profile.
  const [reviewBills, setReviewBills] = useState<Set<string>>(new Set(user.review_bills));
  // Kept in sync with reviewBills on every write, and read (not the state
  // variable) at the start of each toggle. Two overlapping toggles (rapid
  // clicks, network jitter) would otherwise each capture reviewBills via a
  // stale closure — if the earlier call fails after the later one already
  // succeeded, reverting to that stale snapshot would clobber the newer,
  // already-saved state instead of just undoing its own change.
  const reviewBillsRef = useRef(reviewBills);

  async function toggleReview(sourceId: string) {
    const current = reviewBillsRef.current;
    const wasTracked = current.has(sourceId);
    const next = new Set(current);
    if (wasTracked) next.delete(sourceId);
    else next.add(sourceId);
    reviewBillsRef.current = next;
    setReviewBills(next); // optimistic

    try {
      const path = `/users/${encodeURIComponent(user.email)}`;
      const res = await fetch(`/api/user?path=${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_bills: Array.from(next) }),
      });
      if (!res.ok) throw new Error("Failed to update tracked bills.");
    } catch {
      // Undo only this bill's toggle relative to whatever the current state
      // is *now* (not the pre-toggle snapshot from when this call started),
      // so a concurrent successful toggle from another call isn't clobbered.
      setReviewBills(prev => {
        const reverted = new Set(prev);
        if (wasTracked) reverted.add(sourceId);
        else reverted.delete(sourceId);
        reviewBillsRef.current = reverted;
        return reverted;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-white/10">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={`-mb-px border-b-2 px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
              tab === t
                ? "border-teal text-white"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "yesterday" && (
        <YesterdayTab userEmail={user.email} reviewBills={reviewBills} onToggleReview={toggleReview} />
      )}
      {tab === "ask" && (
        <AskTab userEmail={user.email} reviewBills={reviewBills} onToggleReview={toggleReview} />
      )}
      {tab === "tracked" && (
        <TrackedTab userEmail={user.email} reviewBills={reviewBills} onToggleReview={toggleReview} />
      )}
      {tab === "preferences" && <PreferencesTab user={user} />}
    </div>
  );
}
