"use client";

import { useEffect, useState } from "react";
import { BillCard } from "./bill-card";
import type { Bill } from "./types";

export function TrackedTab({
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

  useEffect(() => {
    const path = `/users/${encodeURIComponent(userEmail)}/review-bills`;
    setLoading(true);
    setError(null);
    fetch(`/api/user?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(data => setBills(data.results || []))
      .catch(() => setError("Could not load your tracked bills."))
      .finally(() => setLoading(false));
  }, [userEmail]);

  // Filtering by the shared reviewBills set (not just the initial fetch)
  // means untracking a bill from here — or from any other tab — hides it
  // immediately without needing a refetch.
  const visibleBills = bills.filter(b => reviewBills.has(b.source_id));

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-white/40">Loading your tracked bills…</p>}
      {error && <p className="font-mono text-xs text-coral">{error}</p>}

      {!loading && !error && visibleBills.length === 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.01] p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal">☆</div>
          <div>
            <p className="font-semibold text-white">No tracked bills yet.</p>
            <p className="mt-1 text-sm text-white/50">
              Click &quot;Track&quot; on any bill to pin it here — tracked bills are always included in your digest emails.
            </p>
          </div>
        </div>
      )}

      {visibleBills.map(bill => (
        <BillCard
          key={bill.source_id}
          bill={bill}
          userEmail={userEmail}
          showTrackButton
          isTracked
          onToggleTrack={b => onToggleReview(b.source_id)}
        />
      ))}
    </div>
  );
}
