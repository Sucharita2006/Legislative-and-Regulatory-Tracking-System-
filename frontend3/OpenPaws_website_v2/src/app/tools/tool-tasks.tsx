"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared lifecycle for the long-running advocate tools (legal & org research).
 *
 * The streaming request lives here, in a provider mounted by the persistent
 * /tools layout, NOT in the per-tool page component. That's the whole point:
 * pages unmount when you switch tools, which would otherwise abort an in-flight
 * request. Keeping the fetch up here lets a request finish while you're on a
 * different tool, and lets ToolsNav show an unread badge on the tool that's
 * ready — instead of yanking you back to it.
 */

type StreamEvent = {
  type: "begin" | "item" | "keepalive" | "end" | string;
  content?: string;
  metadata?: { nodeName?: string };
};

export type ToolTaskState = {
  running: boolean;
  status: string | null;
  result: string;
  error: string | null;
  /** True once a result/error has arrived but the user hasn't viewed it yet. */
  unread: boolean;
};

const EMPTY: ToolTaskState = {
  running: false,
  status: null,
  result: "",
  error: null,
  unread: false,
};

type StartOptions = {
  /** API endpoint to POST to, e.g. "/api/legal-research". */
  endpoint: string;
  /** JSON body to send. */
  body: unknown;
  /**
   * Async (fire-and-poll) mode. The endpoint returns `{ runId }` immediately;
   * we then poll /api/tool-runs/{runId} until the run is done/errored. Used by
   * the long n8n tools (legal-research, org-research) that outlive a function.
   * When false/omitted, the endpoint streams NDJSON back directly.
   */
  poll?: boolean;
  /**
   * Turns a completed run's stored result into markdown. For polled tools the
   * result may be JSON (e.g. org-research's variants) or plain markdown; for the
   * legacy streaming path it converts a single non-NDJSON payload.
   */
  payloadToMarkdown?: (raw: string) => string;
  /**
   * For streaming tools whose upstream emits progress/narration items before the
   * actual report: once this marker appears in the accumulated stream, everything
   * before it is dropped so the result begins at the report. (The n8n webhook's
   * final payload starts here too, e.g. "## Intelligence Report"; the stream just
   * leaks the lead-up that the webhook itself doesn't return.)
   */
  reportMarker?: string;
};

/** How often to poll an async run for completion. */
const POLL_INTERVAL_MS = 4_000;

/** Promise that resolves after `ms`, or rejects (AbortError) if aborted. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const id = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Drops anything streamed before the report. If `marker` is set and found in
 * `content`, returns from the start of the marker's line onward; otherwise
 * returns `content` unchanged — the fallback. That covers two cases that must
 * both keep showing everything: no marker seen *yet* (still streaming the
 * lead-up, so the panel isn't blank) and no marker present *at all* (the report
 * was phrased differently or never arrived — show what we got rather than hide
 * it). Matching is case-insensitive and ignores the leading "#"s so minor
 * heading variations ("## Intelligence Report", "# intelligence report") still
 * trim.
 */
function trimToReport(content: string, marker?: string): string {
  if (!marker) return content;
  const needle = marker.replace(/^#+\s*/, "").toLowerCase();
  // Find the heading line whose text (after its "#"s) starts with the marker.
  const re = new RegExp(
    `^#{1,6}\\s*${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "im",
  );
  const m = re.exec(content);
  return m ? content.slice(m.index) : content;
}

type ResumeOptions = {
  /** Existing tool_runs row to re-attach to (e.g. after a page reload). */
  runId: string;
  /** Same result-to-markdown hook as StartOptions. */
  payloadToMarkdown?: (raw: string) => string;
};

type ToolTasksContextValue = {
  /** Read a tool's current state (never undefined; defaults to EMPTY). */
  get: (slug: string) => ToolTaskState;
  /** Slugs that have an unread (ready, unviewed) result or error. */
  unreadSlugs: string[];
  /** Slugs with a request currently running in the background. */
  runningSlugs: string[];
  /** Begin a streaming request for a tool. No-op if one is already running. */
  start: (slug: string, opts: StartOptions) => void;
  /**
   * Re-attach to a run that's still pending server-side — a page reload loses
   * this provider's in-memory state, so without this a run started before the
   * reload would only ever surface via the History panel.
   */
  resume: (slug: string, opts: ResumeOptions) => void;
  /** Abort a tool's in-flight request. */
  stop: (slug: string) => void;
  /** Mark a tool as viewed, clearing its unread badge. */
  markRead: (slug: string) => void;
};

const ToolTasksContext = createContext<ToolTasksContextValue | null>(null);

export function ToolTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Record<string, ToolTaskState>>({});
  // Abort controllers are kept in a ref — they aren't render state.
  const controllers = useRef<Record<string, AbortController>>({});

  const patch = useCallback(
    (slug: string, partial: Partial<ToolTaskState>) => {
      setTasks((prev) => ({
        ...prev,
        [slug]: { ...EMPTY, ...prev[slug], ...partial },
      }));
    },
    [],
  );

  const get = useCallback(
    (slug: string): ToolTaskState => tasks[slug] ?? EMPTY,
    [tasks],
  );

  const markRead = useCallback((slug: string) => {
    setTasks((prev) => {
      const cur = prev[slug];
      if (!cur?.unread) return prev;
      return { ...prev, [slug]: { ...cur, unread: false } };
    });
  }, []);

  const stop = useCallback((slug: string) => {
    controllers.current[slug]?.abort();
  }, []);

  // Flip a tool to "no longer running"; mark it unread if it produced
  // something. Shared by the streaming, polling, and resume completion paths.
  const settle = useCallback((slug: string) => {
    delete controllers.current[slug];
    setTasks((prev) => {
      const cur = prev[slug] ?? EMPTY;
      const produced = !!cur.result.trim() || !!cur.error;
      return {
        ...prev,
        [slug]: { ...cur, running: false, status: null, unread: produced },
      };
    });
  }, []);

  /** Poll one tool_runs row until it's terminal (or the controller aborts). */
  const pollRun = useCallback(
    async (
      slug: string,
      runId: string,
      controller: AbortController,
      payloadToMarkdown?: (raw: string) => string,
    ) => {
      for (;;) {
        await sleep(POLL_INTERVAL_MS, controller.signal);
        const poll = await fetch(`/api/tool-runs/${runId}`, {
          signal: controller.signal,
        });
        const run = await poll.json().catch(() => null);
        if (!poll.ok || !run) {
          // A transient poll failure shouldn't kill the run — keep trying.
          continue;
        }
        if (run.status === "error") {
          patch(slug, { error: run.error ?? "The run failed." });
          return;
        }
        if (run.status === "done") {
          const raw = String(run.result ?? "");
          const md = payloadToMarkdown ? payloadToMarkdown(raw) : raw;
          patch(slug, { result: md, status: null });
          return;
        }
        // still pending → loop
      }
    },
    [patch],
  );

  const resume = useCallback(
    (slug: string, opts: ResumeOptions) => {
      if (controllers.current[slug]) return;
      const controller = new AbortController();
      controllers.current[slug] = controller;
      patch(slug, {
        running: true,
        status: "Reconnected to your earlier report — still working…",
        result: "",
        error: null,
        unread: false,
      });
      void (async () => {
        try {
          await pollRun(slug, opts.runId, controller, opts.payloadToMarkdown);
        } catch (err) {
          if ((err as Error)?.name !== "AbortError") {
            patch(slug, { error: "Lost connection while waiting. Please try again." });
          }
        } finally {
          settle(slug);
        }
      })();
    },
    [patch, pollRun, settle],
  );

  const start = useCallback(
    (slug: string, opts: StartOptions) => {
      // Guard against double-submits while a request is already streaming.
      if (controllers.current[slug]) return;

      const controller = new AbortController();
      controllers.current[slug] = controller;

      // Reset state for a fresh run. Not unread yet — only flips on completion.
      patch(slug, {
        running: true,
        status: "Starting…",
        result: "",
        error: null,
        unread: false,
      });

      // ── Async fire-and-poll path (long n8n tools) ──────────────────────────
      if (opts.poll) {
        void (async () => {
          try {
            const res = await fetch(opts.endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(opts.body),
              signal: controller.signal,
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.runId) {
              patch(slug, { error: data?.error ?? `Request failed (${res.status}).` });
              return;
            }

            patch(slug, { status: "Working… this can take 5–20 minutes." });
            await pollRun(slug, data.runId, controller, opts.payloadToMarkdown);
          } catch (err) {
            if ((err as Error)?.name !== "AbortError") {
              patch(slug, { error: "Lost connection while waiting. Please try again." });
            }
          } finally {
            settle(slug);
          }
        })();
        return;
      }

      // ── Legacy streaming path (NDJSON straight to the browser) ─────────────
      void (async () => {
        let content = "";
        try {
          const res = await fetch(opts.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(opts.body),
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
            patch(slug, { error: message });
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let sawEvent = false;

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
                continue; // skip malformed / non-JSON lines (e.g. a leading "200")
              }

              if (evt && typeof evt === "object" && "type" in evt) {
                sawEvent = true;
                if (evt.type === "begin") {
                  patch(slug, { status: evt.metadata?.nodeName ?? "Working…" });
                } else if (evt.type === "item" && typeof evt.content === "string") {
                  content += evt.content;
                  patch(slug, { result: trimToReport(content, opts.reportMarker) });
                } else if (evt.type === "end") {
                  patch(slug, { status: null });
                }
                // "keepalive" → ignore
              }
            }
          }

          // No streaming events → the whole body was a single payload.
          if (!sawEvent && opts.payloadToMarkdown) {
            content = opts.payloadToMarkdown(buffer);
            patch(slug, { result: trimToReport(content, opts.reportMarker) });
          }

          if (!content.trim()) {
            patch(slug, {
              error: "The request finished but returned no content.",
            });
          }
        } catch (err) {
          if ((err as Error)?.name !== "AbortError") {
            patch(slug, {
              error: "Connection lost while streaming results. Please try again.",
            });
          }
        } finally {
          settle(slug);
        }
      })();
    },
    [patch, pollRun, settle],
  );

  const unreadSlugs = useMemo(
    () => Object.keys(tasks).filter((slug) => tasks[slug]?.unread),
    [tasks],
  );

  const runningSlugs = useMemo(
    () => Object.keys(tasks).filter((slug) => tasks[slug]?.running),
    [tasks],
  );

  const value = useMemo<ToolTasksContextValue>(
    () => ({ get, unreadSlugs, runningSlugs, start, resume, stop, markRead }),
    [get, unreadSlugs, runningSlugs, start, resume, stop, markRead],
  );

  return (
    <ToolTasksContext.Provider value={value}>
      {children}
    </ToolTasksContext.Provider>
  );
}

export function useToolTasks(): ToolTasksContextValue {
  const ctx = useContext(ToolTasksContext);
  if (!ctx)
    throw new Error("useToolTasks must be used within a ToolTasksProvider");
  return ctx;
}
