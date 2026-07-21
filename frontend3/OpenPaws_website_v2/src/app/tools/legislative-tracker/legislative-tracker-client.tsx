"use client";

import { useRef, useState } from "react";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { Heading } from "@/components/ui";
import { LEGISLATIVE_TOPICS } from "@/lib/tracked-legislations-types";

function renderMarkdown(md: string): string {
  return micromark(md, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
}

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

type StreamEvent = {
  type: "begin" | "item" | "keepalive" | "end" | string;
  content?: string;
  metadata?: { nodeName?: string };
};

export function LegislativeTrackerClient() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q || running) return;

    setRunning(true);
    setError(null);
    setResult("");
    setStatus("Starting…");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/legislative-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let message = `Request failed (${res.status}).`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          /* keep default */
        }
        setError(message);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          let evt: StreamEvent;
          try {
            evt = JSON.parse(line);
          } catch {
            continue; 
          }

          if (evt.type === "begin") {
            setStatus(evt.metadata?.nodeName ?? "Working…");
          } else if (evt.type === "item" && typeof evt.content === "string") {
            content += evt.content;
            setResult(content);
          } else if (evt.type === "end") {
            setStatus(null);
          }
        }
      }

      setStatus(null);
      if (!content.trim()) {
        setError("The tracker finished but returned no content.");
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setStatus(null);
      } else {
        setError("Connection lost while streaming results. Please try again.");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Legislative <span className="italic">Tracker</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-white/60">
        Track animal welfare and protection legislation. The assistant searches across
        databases and streams back its findings.
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
          placeholder="e.g. What are the key legislative proposals regarding factory farming welfare in state congresses this year?"
          disabled={running}
          className="min-h-[10rem] w-full resize-y rounded-xl border border-white/15 bg-black px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={running || !prompt.trim()}
            className="rounded-full bg-teal px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a] disabled:pointer-events-none disabled:opacity-40"
          >
            {running ? "Tracking…" : "Track legislation"}
          </button>
          {running && (
            <button
              type="button"
              onClick={stop}
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

      <div className="mt-8">
        <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-white/40">
          Add a topic to your prompt
        </p>
        <div className="flex flex-wrap gap-2">
          {LEGISLATIVE_TOPICS.map(({ emoji, label }) => {
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
