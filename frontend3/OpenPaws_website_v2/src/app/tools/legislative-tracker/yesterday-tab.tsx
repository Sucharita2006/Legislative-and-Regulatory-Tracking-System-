"use client";

import { useEffect, useState } from "react";
import { BillCard } from "./bill-card";
import { TagFilter } from "./tag-filter";
import type { Bill } from "./types";
import { getNextDigestCronRun, formatTimeUntil } from "@/lib/cron-schedule";

const TWO_DAYS_AGO = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toISOString().split("T")[0];
})();

const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
})();

export function YesterdayTab({
  userEmail,
  reviewBills,
  onToggleReview,
}: {
  userEmail: string;
  reviewBills: Set<string>;
  onToggleReview: (sourceId: string) => void;
}) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState("");
  const [tagsRefreshSignal, setTagsRefreshSignal] = useState(0);
  const [nextCronRun, setNextCronRun] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);
      setNextCronRun(getNextDigestCronRun(current));
    };
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      from_action_date: TWO_DAYS_AGO,
      to_action_date: YESTERDAY,
      sort_by: "last_action_date",
      order: "desc",
      limit: "20",
      user_email: userEmail,
    });
    if (tagFilter) params.set("tag", tagFilter);
    const backendPath = `/documents/search?${params}`;
    setLoading(true);
    fetch(`/api/bills?path=${encodeURIComponent(backendPath)}`)
      .then(r => r.json())
      .then(data => setBills(data.results || []))
      .catch(() => setError("Could not load bills. Make sure the backend is running."))
      .finally(() => setLoading(false));
  }, [userEmail, tagFilter]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left side: Bill count stat */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 border border-teal/20 text-teal">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white leading-snug">
              {loading ? (
                "Loading bills..."
              ) : (
                <>
                  <span className="text-teal font-bold text-base mr-1">{bills.length}</span>
                  bill{bills.length !== 1 ? "s" : ""} with actions
                </>
              )}
            </h4>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider mt-0.5">In the last 2 days</p>
          </div>
        </div>

        {/* Right side: Next run info + Tag Filter */}
        <div className="flex flex-wrap items-center gap-4 border-t border-white/5 pt-3 sm:border-t-0 sm:pt-0">
          {nextCronRun && now && (
            <div className="flex items-center gap-2.5">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 leading-none">Next Update</p>
                <p className="text-xs font-semibold text-white mt-1 leading-none">
                  {nextCronRun.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
                </p>
              </div>
              <span className="rounded-full bg-teal/10 border border-teal/30 px-2.5 py-1 text-xs font-mono font-medium text-teal leading-none">
                {formatTimeUntil(nextCronRun, now)}
              </span>
            </div>
          )}

          <div className="h-8 w-px bg-white/10 hidden sm:block" />

          <div>
            <TagFilter userEmail={userEmail} value={tagFilter} onChange={setTagFilter} refreshSignal={tagsRefreshSignal} />
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-white/40">Loading recent legislative actions…</p>}
      {error && <p className="font-mono text-xs text-coral">{error}</p>}

      {!loading && !error && bills.length === 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.01] p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal">ℹ</div>
          <div>
            <p className="font-semibold text-white">No actions found.</p>
            <p className="mt-1 text-sm text-white/50">
              {tagFilter ? "No bills with this tag in the last two days." : "No legislative actions in the last two days."}
            </p>
          </div>
        </div>
      )}

      {bills.map(bill => (
        <BillCard
          key={bill.source_id}
          bill={bill}
          userEmail={userEmail}
          onTagsChanged={() => setTagsRefreshSignal(s => s + 1)}
          showTrackButton
          isTracked={reviewBills.has(bill.source_id)}
          onToggleTrack={b => onToggleReview(b.source_id)}
        />
      ))}
    </div>
  );
}
