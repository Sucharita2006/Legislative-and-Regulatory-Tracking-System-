"use client";

import { useEffect, useState } from "react";
import { micromark } from "micromark";
import { Heading } from "@/components/ui";
import { useToolTasks } from "../tool-tasks";
import { RunHistory, type HistoryRun } from "../run-history";

const SLUG = "legal-research";

/** A past run picked from the history panel, shown in the result area. */
type PastRun = { label: string; date: string; markdown: string };

/** A run that was still pending server-side when the page rendered. */
export type PendingRun = { id: string; label: string };

export function ResearchClient({
  pendingRun = null,
}: {
  pendingRun?: PendingRun | null;
}) {
  const [prompt, setPrompt] = useState("");
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
    if (pendingRun) resume(SLUG, { runId: pendingRun.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  function run(e: React.FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q || running) return;
    setViewing(null);
    start(SLUG, {
      endpoint: "/api/legal-research",
      body: { prompt: q },
      poll: true,
    });
  }

  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Legal <span className="italic">research</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-sm text-white/50">
        Disclaimer: This tool provides legal research to help you explore
        relevant laws and regulations. It does not constitute legal advice. For
        guidance specific to your situation, consult a qualified attorney.
      </p>
      <p className="mt-3 max-w-2xl text-white/60">
        Ask a question about animal-related law and policy. The assistant
        searches legal databases and streams back its findings. You can switch
        to another tool while it works — a badge will appear here when it&rsquo;s
        ready.
      </p>

      <form onSubmit={run} className="mt-8">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void run(e);
            }
          }}
          rows={6}
          placeholder="e.g. What are the animal welfare issues associated with puppy mills?"
          disabled={running}
          className="min-h-[10rem] w-full resize-y rounded-xl border border-white/15 bg-black px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={running || !prompt.trim()}
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
            runLabel={(input) => String(input?.prompt ?? "")}
            onSelect={(run: HistoryRun) =>
              setViewing({
                label: String(run.input?.prompt ?? ""),
                date: new Date(run.created_at).toLocaleString(),
                markdown: run.result ?? "",
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
