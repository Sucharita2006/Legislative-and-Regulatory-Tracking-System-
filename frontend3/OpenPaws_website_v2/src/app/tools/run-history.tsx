"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Run history for the async research tools (legal & org research).
 *
 * Renders a "History" button (placed by the parent — pass `className` to
 * position it); clicking it slides open a right-hand panel listing the user's
 * past runs of `tool`, fetched from /api/tool-runs?tool=… (which RLS scopes to
 * their own rows). Selecting a completed run hands it to the parent via
 * `onSelect`, which shows the stored report in its result area.
 *
 * The list is fetched every time the panel opens, so a run that finished while
 * the panel was closed appears without a page reload.
 */

export type HistoryRun = {
  id: string;
  status: "pending" | "done" | "error";
  input: Record<string, unknown>;
  result: string | null;
  error: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RunHistory({
  tool,
  runLabel,
  onSelect,
  className = "",
}: {
  /** Tool slug whose runs to list, e.g. "legal-research". */
  tool: string;
  /** Derives a human label for a run from its stored input. */
  runLabel: (input: Record<string, unknown>) => string;
  /** Called with a completed run when the user picks it from the list. */
  onSelect: (run: HistoryRun) => void;
  /** Extra classes for the trigger button (e.g. "ml-auto" to right-align). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<HistoryRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Two-step delete: first click arms the button ("Remove?"), second deletes.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/tool-runs?tool=${encodeURIComponent(tool)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.runs)) {
        setError(data?.error ?? "Couldn't load your research history.");
        return;
      }
      setRuns(data.runs as HistoryRun[]);
    } catch {
      setError("Couldn't load your research history.");
    }
  }, [tool]);

  // Refetch on every open so just-finished runs show up.
  useEffect(() => {
    if (open) void load();
    else setConfirmId(null);
  }, [open, load]);

  /**
   * Remove a run from the history. Soft delete — the server keeps the row as a
   * log and only hides it from this panel. Optimistic: the entry disappears
   * immediately; if the request fails we reload the list to restore it.
   */
  async function remove(id: string) {
    setConfirmId(null);
    setRuns((prev) => prev?.filter((r) => r.id !== id) ?? prev);
    try {
      const res = await fetch(`/api/tool-runs/${id}`, { method: "DELETE" });
      if (!res.ok) void load();
    } catch {
      void load();
    }
  }

  return (
    <>
      {/* A regular button the parent positions — the previous fixed vertical
          edge tab sat half-clipped at the viewport edge and was easy to miss. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-full border border-white/20 px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-teal hover:text-white ${className}`}
        aria-label="Open research history"
      >
        History
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-black"
            role="dialog"
            aria-label="Research history"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-white/70">
                Previous research
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-white hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {error && (
                <p className="font-mono text-xs text-coral" role="alert">
                  {error}
                </p>
              )}
              {!error && runs === null && (
                <p className="text-sm text-white/40">Loading…</p>
              )}
              {!error && runs?.length === 0 && (
                <p className="text-sm text-white/40">
                  No previous research yet. Reports you run will appear here.
                </p>
              )}
              {runs?.map((run) => {
                const label = runLabel(run.input) || "Untitled research";
                const selectable = run.status === "done" && !!run.result;
                const confirming = confirmId === run.id;
                return (
                  <div
                    key={run.id}
                    className="flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition-colors hover:border-teal/60"
                  >
                    <button
                      type="button"
                      disabled={!selectable}
                      onClick={() => {
                        onSelect(run);
                        setOpen(false);
                      }}
                      className="min-w-0 flex-1 p-4 text-left disabled:cursor-default"
                    >
                      <p className="line-clamp-2 text-sm text-white/80">{label}</p>
                      <p className="mt-2 flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/35">
                        {formatDate(run.created_at)}
                        {run.status === "pending" && (
                          <span className="flex items-center gap-1.5 text-teal">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
                            In progress
                          </span>
                        )}
                        {run.status === "error" && (
                          <span className="text-coral">Failed</span>
                        )}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirming ? void remove(run.id) : setConfirmId(run.id)
                      }
                      onBlur={() => confirming && setConfirmId(null)}
                      aria-label={
                        confirming
                          ? "Confirm removing this run from your history"
                          : "Remove this run from your history"
                      }
                      className={`shrink-0 border-l border-white/10 px-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] transition-colors ${
                        confirming
                          ? "bg-coral/15 text-coral"
                          : "text-white/30 hover:bg-white/[0.06] hover:text-coral"
                      }`}
                    >
                      {confirming ? "Sure?" : "✕"}
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
