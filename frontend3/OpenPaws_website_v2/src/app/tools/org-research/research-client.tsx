"use client";

import { useEffect, useState } from "react";
import { micromark } from "micromark";
import { Heading } from "@/components/ui";
import { useToolTasks } from "../tool-tasks";
import { RunHistory, type HistoryRun } from "../run-history";

const SLUG = "org-research";

/** A past run picked from the history panel, shown in the result area. */
type PastRun = { label: string; date: string; markdown: string };

/**
 * Turns whatever the org-osint webhook returns into markdown. The workflow may
 * send a single JSON object (e.g. { report }, { output }, { text }) or a raw
 * markdown/text string, so we probe a few common shapes before falling back to
 * pretty-printed JSON.
 */
function payloadToMarkdown(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const data = JSON.parse(trimmed);
    if (typeof data === "string") return data;
    const text =
      data?.report ?? data?.output ?? data?.markdown ?? data?.text ?? data?.result;
    if (typeof text === "string" && text.trim()) return text;
    return "```json\n" + JSON.stringify(data, null, 2) + "\n```";
  } catch {
    // Not JSON — treat as raw markdown/text.
    return trimmed;
  }
}

/** A run that was still pending server-side when the page rendered. */
export type PendingRun = { id: string; label: string };

export function ResearchClient({
  pendingRun = null,
}: {
  pendingRun?: PendingRun | null;
}) {
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [reportGoal, setReportGoal] = useState("");
  const [viewing, setViewing] = useState<PastRun | null>(null);
  const { get, start, resume, stop, markRead } = useToolTasks();
  const task = get(SLUG);
  const { running, status, result, error } = task;

  // Viewing the tool clears its unread badge (the result is now "seen").
  useEffect(() => {
    if (task.unread) markRead(SLUG);
  }, [task.unread, markRead]);

  // A page reload loses the provider's in-memory task state, orphaning a run
  // that's still working server-side. Re-attach to it so the progress panel
  // and the ready badge come back instead of the run only living in History.
  useEffect(() => {
    if (pendingRun) resume(SLUG, { runId: pendingRun.id, payloadToMarkdown });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  function run(e: React.FormEvent) {
    e.preventDefault();
    const name = companyName.trim();
    if (!name || running) return;
    setViewing(null);
    start(SLUG, {
      endpoint: "/api/org-research",
      body: {
        companyName: name,
        companyDomain: companyDomain.trim(),
        reportGoal: reportGoal.trim(),
      },
      poll: true,
      payloadToMarkdown,
    });
  }

  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Organization <span className="italic">research</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-white/60">
        Gather open-source intelligence on a company — structure, key people,
        recent news, and other public data. Enter a company and an optional goal
        for the report. You can switch to another tool while it works — a badge
        will appear here when it&rsquo;s ready.
      </p>

      <form onSubmit={run} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="companyName"
              className="mb-2 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40"
            >
              Company name
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Unilever"
              disabled={running}
              className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="companyDomain"
              className="mb-2 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40"
            >
              Company domain <span className="text-white/25">(optional)</span>
            </label>
            <input
              id="companyDomain"
              type="text"
              value={companyDomain}
              onChange={(e) => setCompanyDomain(e.target.value)}
              placeholder="e.g. unilever.com"
              disabled={running}
              className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reportGoal"
            className="mb-2 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40"
          >
            Report goal <span className="text-white/25">(optional)</span>
          </label>
          <textarea
            id="reportGoal"
            value={reportGoal}
            onChange={(e) => setReportGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void run(e);
              }
            }}
            rows={4}
            placeholder="e.g. Company structure, key executives, recent news, financials, and any relevant public data."
            disabled={running}
            className="min-h-[7rem] w-full resize-y rounded-xl border border-white/15 bg-black px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={running || !companyName.trim()}
            className="rounded-full bg-teal px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a] disabled:pointer-events-none disabled:opacity-40"
          >
            {running ? "Researching…" : "Research"}
          </button>
          {running && (
            <button
              type="button"
              onClick={() => stop(SLUG)}
              className="rounded-full border border-white/30 px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-white hover:text-white"
            >
              Stop
            </button>
          )}
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/30">
            Ctrl/⌘ + Enter
          </span>
          <RunHistory
            className="ml-auto"
            tool={SLUG}
            runLabel={(input) => String(input?.companyName ?? "")}
            onSelect={(run: HistoryRun) =>
              setViewing({
                label: String(run.input?.companyName ?? ""),
                date: new Date(run.created_at).toLocaleString(),
                markdown: payloadToMarkdown(run.result ?? ""),
              })
            }
          />
        </div>
      </form>

      {error && (
        <p className="mt-6 font-mono text-xs text-coral" role="alert">
          {error}
        </p>
      )}

      {viewing && !running ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-white/40">
              Past research · {viewing.date}
            </p>
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="rounded-full border border-white/20 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-white hover:text-white"
            >
              Close
            </button>
          </div>
          {viewing.label && (
            <p className="mb-4 text-sm italic text-white/50">{viewing.label}</p>
          )}
          <div
            className="prose-paws"
            dangerouslySetInnerHTML={{ __html: micromark(viewing.markdown) }}
          />
        </div>
      ) : (
        (running || result) && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            {status && (
              <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-teal">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
                {status}
              </p>
            )}
            {result ? (
              <div
                className="prose-paws"
                dangerouslySetInnerHTML={{ __html: micromark(result) }}
              />
            ) : (
              <p className="text-sm text-white/40">
                Waiting for results… this usually takes 5–20 minutes. You can
                switch to another tool — the sidebar shows when it&rsquo;s ready.
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}
