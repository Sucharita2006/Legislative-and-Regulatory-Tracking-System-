"use client";

import { useEffect, useState } from "react";
import { micromark } from "micromark";
import { Heading } from "@/components/ui";
import { useToolTasks } from "../tool-tasks";
import { RunHistory, type HistoryRun } from "../run-history";

const SLUG = "personal-research";

/** A past run picked from the history panel, shown in the result area. */
type PastRun = { label: string; date: string; markdown: string };

/**
 * Turns whatever the personal-research webhook returns into markdown. The
 * workflow may send a single JSON object (e.g. { report }, { output }, { text })
 * or a raw markdown/text string, so we probe a few common shapes before falling
 * back to pretty-printed JSON.
 */
function payloadToMarkdown(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    let data = JSON.parse(trimmed);
    // n8n items are arrays — unwrap a single-item wrapper.
    if (Array.isArray(data) && data.length === 1) data = data[0];
    if (typeof data === "string") return data;
    const text =
      data?.["Final Report"] ??
      data?.report ??
      data?.output ??
      data?.markdown ??
      data?.text ??
      data?.result;
    if (typeof text === "string" && text.trim()) return text;
    // Any object that is just one string field IS the report, whatever the key.
    const values = Object.values(data ?? {});
    if (values.length === 1 && typeof values[0] === "string" && values[0].trim()) {
      return values[0];
    }
    return "```json\n" + JSON.stringify(data, null, 2) + "\n```";
  } catch {
    // Not JSON — treat as raw markdown/text.
    return trimmed;
  }
}

/** Label for a run, from its stored input: "First Last". */
function runLabel(input: Record<string, unknown> | undefined): string {
  return `${input?.firstName ?? ""} ${input?.lastName ?? ""}`.trim();
}

/** A run that was still pending server-side when the page rendered. */
export type PendingRun = { id: string; label: string };

export function ResearchClient({
  pendingRun = null,
}: {
  pendingRun?: PendingRun | null;
}) {
  const [linkedinURL, setLinkedinURL] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [reportGoal, setReportGoal] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PastRun | null>(null);
  const { get, start, resume, stop, markRead } = useToolTasks();
  const task = get(SLUG);
  const { running, status, result, error } = task;

  const complete =
    linkedinURL.trim() &&
    firstName.trim() &&
    lastName.trim() &&
    companyName.trim() &&
    companyDomain.trim();

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
    if (!complete || running) return;
    // The LinkedIn URL doubles as the Humantic user id downstream, so it must
    // be a profile URL — mirror the server's check for immediate feedback.
    if (!linkedinURL.includes("linkedin.com/in/")) {
      setFormError("Please enter a LinkedIn profile URL (…linkedin.com/in/…).");
      return;
    }
    setFormError(null);
    setViewing(null);
    start(SLUG, {
      endpoint: "/api/personal-research",
      body: {
        linkedinURL: linkedinURL.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        companyDomain: companyDomain.trim(),
        reportGoal: reportGoal.trim(),
      },
      poll: true,
      payloadToMarkdown,
    });
  }

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50";
  const labelClass =
    "mb-2 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40";

  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Personal <span className="italic">research</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-white/60">
        Build a research profile of a person — background, role, and public
        information — from their LinkedIn profile and company. You can switch to
        another tool while it works — a badge will appear here when it&rsquo;s
        ready.
      </p>

      <form onSubmit={run} className="mt-8 space-y-4">
        <div>
          <label htmlFor="linkedinURL" className={labelClass}>
            LinkedIn profile URL
          </label>
          <input
            id="linkedinURL"
            type="url"
            value={linkedinURL}
            onChange={(e) => setLinkedinURL(e.target.value)}
            placeholder="e.g. https://www.linkedin.com/in/jane-doe/"
            disabled={running}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={labelClass}>
              First name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Jane"
              disabled={running}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={labelClass}>
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Doe"
              disabled={running}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="companyName" className={labelClass}>
              Company name
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Unilever"
              disabled={running}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="companyDomain" className={labelClass}>
              Company domain
            </label>
            <input
              id="companyDomain"
              type="text"
              value={companyDomain}
              onChange={(e) => setCompanyDomain(e.target.value)}
              placeholder="e.g. unilever.com"
              disabled={running}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="reportGoal" className={labelClass}>
            Report goal <span className="normal-case text-white/25">(optional)</span>
          </label>
          <textarea
            id="reportGoal"
            value={reportGoal}
            onChange={(e) => setReportGoal(e.target.value)}
            placeholder="What should the report focus on? e.g. Prepare for an outreach call about plant-based sourcing"
            disabled={running}
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={running || !complete}
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
          <RunHistory
            className="ml-auto"
            tool={SLUG}
            runLabel={runLabel}
            onSelect={(run: HistoryRun) =>
              setViewing({
                label: runLabel(run.input),
                date: new Date(run.created_at).toLocaleString(),
                markdown: payloadToMarkdown(run.result ?? ""),
              })
            }
          />
        </div>
      </form>

      {(formError || error) && (
        <p className="mt-6 font-mono text-xs text-coral" role="alert">
          {formError ?? error}
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
                Waiting for results… this can take several minutes. You can
                switch to another tool — the sidebar shows when it&rsquo;s
                ready.
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}
