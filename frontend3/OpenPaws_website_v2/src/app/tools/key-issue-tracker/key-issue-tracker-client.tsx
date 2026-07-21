"use client";

import { useEffect, useState } from "react";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { Heading } from "@/components/ui";
import { KEY_ISSUES } from "@/lib/tracked-issues-types";
import { useToolTasks } from "../tool-tasks";

const SLUG = "key-issue-tracker";

/** Render Markdown (incl. GFM tables) to HTML. */
function renderMarkdown(md: string): string {
  return micromark(md, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
}

/**
 * Turns the stored tool_run result into markdown. The general-research workflow
 * posts its finished answer back to the callback as JSON (e.g. { report },
 * { output }, { text }) or as a raw markdown string, so we probe a few shapes
 * before falling back to the raw text.
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

// Topics are appended to the prompt as a trailing "Topics: a, b, c" subject
// line, instead of replacing the whole field. Clicking a chip toggles it.
const TOPICS_LINE = /\n*Topics:\s*(.*)\s*$/;

function parseTopicsLine(prompt: string): { body: string; topics: string[] } {
  const match = prompt.match(TOPICS_LINE);
  if (!match) return { body: prompt, topics: [] };
  const topics = match[1]
    .split(/\s*,\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
  return { body: prompt.slice(0, match.index).trimEnd(), topics };
}

function toggleTopicInPrompt(prompt: string, topic: string): string {
  const { body, topics } = parseTopicsLine(prompt);
  const next = topics.includes(topic)
    ? topics.filter((t) => t !== topic)
    : [...topics, topic];
  if (next.length === 0) return body;
  return `${body ? body + "\n\n" : ""}Topics: ${next.join(", ")}`;
}

function promptHasTopic(prompt: string, topic: string): boolean {
  return parseTopicsLine(prompt).topics.includes(topic);
}

export function KeyIssueTrackerClient({
  pendingRunId = null,
}: {
  /** A run still pending server-side, for re-attaching after a reload. */
  pendingRunId?: string | null;
}) {
  const [prompt, setPrompt] = useState("");
  const { get, start, resume, stop, markRead } = useToolTasks();
  const task = get(SLUG);
  const { running, status, result, error } = task;

  // Viewing the tool clears its unread badge (the result is now "seen").
  useEffect(() => {
    if (task.unread) markRead(SLUG);
  }, [task.unread, markRead]);

  // A page reload loses the provider's in-memory task state, orphaning a run
  // that's still working server-side — re-attach so progress isn't lost.
  useEffect(() => {
    if (pendingRunId) resume(SLUG, { runId: pendingRunId, payloadToMarkdown });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  function run(e: React.FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q || running) return;
    start(SLUG, {
      endpoint: "/api/key-issue-tracker",
      body: { prompt: q },
      // Async: the endpoint returns { runId }; we poll /api/tool-runs/{runId}
      // until the callback records the report. The result is stored in Supabase
      // (tool_runs) so it survives switching tools or disconnecting.
      poll: true,
      payloadToMarkdown,
    });
  }

  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Key Issue <span className="italic">Tracker</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-white/60">
        Ask about any animal advocacy issue. The assistant searches across
        sources and compiles a report — this can take several minutes. You can
        switch to another tool while it works; a badge will appear here when
        it&rsquo;s ready, and the report is saved to your account.
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
          placeholder="e.g. What are the most effective corporate pressure campaign strategies used by animal advocacy organizations?"
          disabled={running}
          className="min-h-[10rem] w-full resize-y rounded-xl border border-white/15 bg-black px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={running || !prompt.trim()}
            className="rounded-full bg-teal px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a] disabled:pointer-events-none disabled:opacity-40"
          >
            {/* "Research", not "Track issue" — this tab runs a one-off report;
                tracking/subscribing lives in the Digests tab. */}
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
        </div>
      </form>

      {/* Suggested topics — clicking one appends it to a "Topics:" line at the
          end of your prompt, rather than replacing what you've written. */}
      <div className="mt-8">
        <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-white/40">
          Add a topic to your prompt
        </p>
        <div className="flex flex-wrap gap-2">
          {KEY_ISSUES.map(({ emoji, label }) => {
            const selected = promptHasTopic(prompt, label);
            return (
              <button
                key={label}
                type="button"
                disabled={running}
                aria-pressed={selected}
                onClick={() => setPrompt((p) => toggleTopicInPrompt(p, label))}
                className={`rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                  selected
                    ? "border-teal bg-teal/10 text-white"
                    : "border-white/15 text-white/70 hover:border-teal hover:text-white"
                }`}
              >
                <span aria-hidden="true" className="mr-1.5">{emoji}</span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-6 font-mono text-xs text-coral" role="alert">
          {error}
        </p>
      )}

      {(running || result) && (
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
              dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }}
            />
          ) : (
            <p className="text-sm text-white/40">Waiting for results…</p>
          )}
        </div>
      )}
    </div>
  );
}
