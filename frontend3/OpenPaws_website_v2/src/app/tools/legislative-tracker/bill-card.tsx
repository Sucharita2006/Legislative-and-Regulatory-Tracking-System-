"use client";

import { useState } from "react";
import type { Bill } from "./types";
import { BillTags } from "./bill-tags";

function formatDate(d: string | null | undefined) {
  if (!d) return "N/A";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

async function fetchDetails(sourceId: string) {
  const detailPath = `/documents/${encodeURIComponent(sourceId)}`;
  const actionsPath = `/documents/${encodeURIComponent(sourceId)}/actions`;
  const [detailRes, actionsRes] = await Promise.all([
    fetch(`/api/bills?path=${encodeURIComponent(detailPath)}`),
    fetch(`/api/bills?path=${encodeURIComponent(actionsPath)}`),
  ]);
  const detail = await detailRes.json();
  const actionsData = await actionsRes.json();
  const action_history = (actionsData.actions || []).map((a: Record<string, unknown>) => ({
    date: a.actionDate as string,
    text: a.text as string,
    source: (a.actionCode || (a.sourceSystem as { name?: string })?.name || "") as string,
  }));
  return { ...detail, action_history };
}

export function BillCard({
  bill: initialBill,
  scoreLabel = "AI Score",
  showTrackButton = false,
  isTracked = false,
  onToggleTrack,
  userEmail,
  onTagsChanged,
}: {
  bill: Bill;
  scoreLabel?: string;
  showTrackButton?: boolean;
  isTracked?: boolean;
  onToggleTrack?: (bill: Bill) => void;
  userEmail?: string;
  onTagsChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bill, setBill] = useState<Bill>(initialBill);
  const initialTags = initialBill.tags ?? [];
  const [modalTab, setModalTab] = useState<"overview" | "ai" | "history">("overview");
  const [loading, setLoading] = useState(false);

  async function openModal() {
    setOpen(true);
    setModalTab("overview");
    setLoading(true);
    try {
      const full = await fetchDetails(bill.source_id);
      setBill(full);
    } catch { /* keep initial */ }
    finally { setLoading(false); }
  }

  // When scoreLabel is "Relevance", we are in the Ask tab and have a semantic prompt_score
  const isAskTab = scoreLabel === "Relevance";
  const chamber = (bill.origin_chamber ?? "house").toLowerCase();
  const subjects = bill.subjects?.flatMap(s => s.split(",").map(x => x.trim())).filter(Boolean) ?? [];

  return (
    <>
      <div
        onClick={openModal}
        className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-teal/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {bill.origin_chamber && (
                <span className="rounded border border-white/20 px-2 py-0.5 uppercase">{bill.origin_chamber}</span>
              )}
              <span className="text-white/50">{bill.source_id}</span>
              {bill.policy_area && <span className="text-white/40">{bill.policy_area}</span>}
            </div>
            <p className="mt-2 text-sm font-semibold text-white leading-snug">{bill.title}</p>
            {bill.sponsor_name && (
              <p className="mt-1 text-xs text-white/50">Sponsor: {bill.sponsor_name}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {showTrackButton && onToggleTrack && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggleTrack(bill); }}
                aria-pressed={isTracked}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] transition-colors ${
                  isTracked
                    ? "border-coral/30 bg-coral/10 text-coral/80 hover:bg-coral/20"
                    : "border-white/20 text-white/50 hover:border-coral hover:text-coral"
                }`}
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill={isTracked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.5a.563.563 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.664.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0l-4.725 2.885a.562.562 0 01-.84-.61l1.285-5.385a.563.563 0 00-.182-.557L2.083 10.4a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
                {isTracked ? "Tracked" : "Track"}
              </button>
            )}
            <div className="flex flex-col items-end">
              {bill.relevance_score != null && (
                <span className={`font-mono text-xs ${bill.relevance_score >= 70 ? "text-teal" : "text-yellow-400"}`}>
                  {isAskTab ? "Relevance" : scoreLabel}: {bill.relevance_score}
                </span>
              )}
              {isAskTab && bill.prompt_score != null && (
                <span className={`font-mono text-xs mt-1 ${bill.prompt_score >= 70 ? "text-teal" : "text-yellow-400"}`}>
                  Prompt Relevance: {bill.prompt_score}
                </span>
              )}
            </div>
            {bill.current_stage && (
              <span className="rounded border border-white/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase text-white/40">
                {bill.current_stage}
              </span>
            )}
          </div>
        </div>
        {bill.last_action_text && (
          <div className="mt-3 rounded-lg border border-white/5 bg-black/20 p-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/30">
              Latest action · {formatDate(bill.last_action_date)}
            </p>
            <p className="mt-1 text-xs text-white/60">{bill.last_action_text}</p>
          </div>
        )}
        {subjects.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {subjects.slice(0, 3).map(s => (
              <span key={s} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/50">{s}</span>
            ))}
            {subjects.length > 3 && (
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/40">+{subjects.length - 3} more</span>
            )}
          </div>
        )}
        {userEmail && (
          <BillTags sourceId={bill.source_id} userEmail={userEmail} initialTags={initialTags} onTagsChanged={onTagsChanged} />
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/20 p-1.5 text-white/60 hover:text-white"
            >
              ✕
            </button>

            <div className="px-6 pt-6 pb-4 border-b border-white/10">
              <p className="font-mono text-xs text-white/40">{bill.source_id}</p>
              <h2 className="mt-1 text-lg font-semibold text-white leading-snug">{bill.title}</h2>
            </div>

            <div className="flex gap-4 border-b border-white/10 px-6">
              {(["overview", "ai", "history"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setModalTab(t)}
                  className={`-mb-px border-b-2 py-3 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
                    modalTab === t ? "border-teal text-white" : "border-transparent text-white/40 hover:text-white"
                  }`}
                >
                  {t === "ai" ? "AI Analysis" : t === "history" ? "Action History" : "Overview"}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-6 space-y-4">
              {loading ? (
                <p className="text-center text-sm text-white/40">Loading…</p>
              ) : (
                <>
                  {modalTab === "overview" && (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        {[
                          ["Congress", bill.congress ? `${bill.congress}th` : "N/A"],
                          ["Introduced", formatDate(bill.introduced_date)],
                          ["Sponsor", bill.sponsor_name ?? "N/A"],
                          ["Policy Area", bill.policy_area ?? "N/A"],
                          ["Stage", bill.current_stage ?? "N/A"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <dt className="font-mono text-[0.65rem] uppercase text-white/40">{k}</dt>
                            <dd className="mt-0.5 text-white/80">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="rounded-lg border border-white/5 bg-black/20 p-4">
                        <p className="font-mono text-[0.65rem] uppercase text-white/30">{formatDate(bill.last_action_date)}</p>
                        <p className="mt-1 text-sm text-white/70">{bill.last_action_text}</p>
                        {bill.source_url && (
                          <a
                            href={bill.source_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 font-mono text-xs text-white/60 hover:border-teal hover:text-white"
                          >
                            Open on Congress.gov ↗
                          </a>
                        )}
                      </div>
                      {subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {subjects.map(s => (
                            <span key={s} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/50">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {modalTab === "ai" && (
                    <div className="space-y-4">
                      {!bill.ai_generated_at ? (
                        <p className="text-sm text-white/50">This bill hasn&apos;t been analyzed by AI yet.</p>
                      ) : (
                        <>
                          <div className="flex items-center gap-4">
                            <span className={`text-3xl font-bold ${bill.relevance_score != null && bill.relevance_score >= 70 ? "text-teal" : "text-yellow-400"}`}>
                              {bill.relevance_score}
                            </span>
                            <div>
                              <p className="font-mono text-[0.65rem] uppercase text-white/40">Animal Relevance Score</p>
                              <p className="text-sm text-white/70">
                                {bill.relevance_score != null && bill.relevance_score >= 70 ? "High Relevance" : "Moderate Relevance"}
                              </p>
                            </div>
                          </div>
                          {isAskTab && bill.prompt_score != null && (
                            <div className="flex items-center gap-4">
                              <span className={`text-3xl font-bold ${bill.prompt_score >= 70 ? "text-teal" : "text-yellow-400"}`}>
                                {bill.prompt_score}
                              </span>
                              <div>
                                <p className="font-mono text-[0.65rem] uppercase text-white/40">Prompt Relevance</p>
                                <p className="text-sm text-white/70">
                                  {bill.prompt_score >= 70 ? "High Match" : "Moderate Match"}
                                </p>
                              </div>
                            </div>
                          )}
                          {(bill.relevance_topics?.length ?? 0) > 0 && (
                            <div>
                              <p className="font-mono text-[0.65rem] uppercase text-white/40 mb-2">Extracted Topics</p>
                              <div className="flex flex-wrap gap-1.5">
                                {bill.relevance_topics!.map(t => (
                                  <span key={t} className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs text-white/70">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {bill.relevance_rationale && (
                            <div>
                              <p className="font-mono text-[0.65rem] uppercase text-white/40 mb-1">Rationale</p>
                              <p className="text-sm text-white/70 leading-relaxed">{bill.relevance_rationale}</p>
                            </div>
                          )}
                          {bill.ai_summary && (
                            <div>
                              <p className="font-mono text-[0.65rem] uppercase text-white/40 mb-1">Summary</p>
                              <p className="text-sm text-white/70 leading-relaxed">{bill.ai_summary}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {modalTab === "history" && (
                    <div className="space-y-3">
                      {(bill.action_history?.length
                        ? bill.action_history
                        : [{ date: bill.last_action_date ?? "", text: bill.last_action_text ?? "", source: "" }]
                      ).map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal/60" />
                          <div>
                            <p className="font-mono text-[0.65rem] uppercase text-white/30">{formatDate(item.date)}</p>
                            <p className="mt-0.5 text-sm text-white/70">{item.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
