"use client";

import { useActionState, useEffect, useState } from "react";
import { Heading } from "@/components/ui";
import {
  LEGISLATIVE_TOPICS,
  MAX_TRACKED_LEGISLATIONS,
  parseTopics,
  serializeTopics,
  type Cadence,
  type TrackedLegislation,
} from "@/lib/tracked-legislations-types";
import {
  createTrackedLegislation,
  updateTrackedLegislation,
  deleteTrackedLegislation,
  type LegislativeActionState,
} from "./legislative-actions";

const inputClass =
  "w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none";
const labelClass =
  "block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40";

function cadenceLabel(c: Cadence) {
  return c === "daily" ? "Daily" : "Weekly";
}

function TopicsPicker({ initial = [] }: { initial?: string[] }) {
  const [topics, setTopics] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");

  const has = (label: string) => topics.includes(label);
  const toggle = (label: string) =>
    setTopics((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label],
    );
  const addCustom = () => {
    const value = custom.trim();
    if (value && !topics.includes(value)) setTopics((prev) => [...prev, value]);
    setCustom("");
  };

  const suggested = new Set<string>(LEGISLATIVE_TOPICS.map((k) => k.label));
  const customTopics = topics.filter((t) => !suggested.has(t));

  const submitted = serializeTopics([...topics, custom]);

  return (
    <div>
      <input type="hidden" name="title" value={submitted} />

      <label className={labelClass}>Topics</label>
      <p className="mt-1 mb-2 text-xs text-white/40">
        Pick one or more legislative topics for this digest, or add your own.
      </p>

      <div className="flex flex-wrap gap-2">
        {LEGISLATIVE_TOPICS.map(({ emoji, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => toggle(label)}
            aria-pressed={has(label)}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-colors ${
              has(label)
                ? "border-teal bg-teal/10 text-white"
                : "border-white/15 text-white/70 hover:border-teal hover:text-white"
            }`}
          >
            <span aria-hidden="true" className="mr-1.5">
              {emoji}
            </span>
            {label}
          </button>
        ))}
      </div>

      {customTopics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {customTopics.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className="rounded-full border border-teal bg-teal/10 px-3 py-1.5 font-mono text-xs text-white"
            >
              {t}
              <span aria-hidden="true" className="ml-1.5 text-white/60">
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          maxLength={120}
          placeholder="Add a custom topic…"
          className={inputClass}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim()}
          className="shrink-0 rounded-lg border border-white/20 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-white hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function TrackedLegislationsClient({ legislations }: { legislations: TrackedLegislation[] }) {
  const atLimit = legislations.length >= MAX_TRACKED_LEGISLATIONS;

  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Legislative <span className="italic">digests</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-white/60">
        Track up to {MAX_TRACKED_LEGISLATIONS} bills. We&apos;ll research each on
        your chosen cadence and email you a digest. You have used{" "}
        <span className="text-white">{legislations.length}</span> of{" "}
        {MAX_TRACKED_LEGISLATIONS}.
      </p>

      <ul className="mt-8 space-y-4">
        {legislations.map((leg) => (
          <LegislationCard key={leg.id} legislation={leg} />
        ))}
        {legislations.length === 0 && (
          <li className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-white/40">
            No tracked bills yet. Add one below to start receiving digests.
          </li>
        )}
      </ul>

      {atLimit ? (
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.15em] text-white/40">
          You&apos;ve reached the limit of {MAX_TRACKED_LEGISLATIONS} tracked bills.
          Delete one to add another.
        </p>
      ) : (
        <NewLegislationForm />
      )}
    </div>
  );
}

function NewLegislationForm() {
  const [state, action, pending] = useActionState<LegislativeActionState, FormData>(
    createTrackedLegislation,
    null,
  );

  return (
    <form
      action={action}
      key={state?.message}
      className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
    >
      <Heading as="h3" className="text-lg text-white">
        Track a new bill
      </Heading>
      <div className="mt-4 space-y-4">
        <TopicsPicker />
        <div>
          <label className={labelClass} htmlFor="new-prompt">
            Research prompt
          </label>
          <textarea
            id="new-prompt"
            name="prompt"
            required
            rows={3}
            placeholder="Enter your prompt to customize your daily/weekly report"
            className={`mt-1 resize-y ${inputClass}`}
          />
        </div>
        <CadenceSelect name="cadence" defaultValue="weekly" idPrefix="new" />
      </div>

      {state?.error && (
        <p className="mt-4 font-mono text-xs text-coral" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-full bg-teal px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a] disabled:pointer-events-none disabled:opacity-40"
      >
        {pending ? "Adding…" : "Add bill"}
      </button>
    </form>
  );
}

function LegislationCard({ legislation }: { legislation: TrackedLegislation }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<LegislativeActionState, FormData>(
    updateTrackedLegislation,
    null,
  );

  useEffect(() => {
    if (state?.message) setEditing(false);
  }, [state?.message]);

  const topics = parseTopics(legislation.title);

  if (!editing) {
    return (
      <li className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {topics.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-white"
                >
                  {t}
                </span>
              ))}
              <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-white/50">
                {cadenceLabel(legislation.cadence)}
              </span>
              {!legislation.active && (
                <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-white/40">
                  Paused
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-white/60">
              {legislation.prompt}
            </p>
            <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-white/30">
              {legislation.last_sent_at
                ? `Last sent ${new Date(legislation.last_sent_at).toLocaleDateString()}`
                : "Not sent yet"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-white/20 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-white hover:text-white"
            >
              Edit
            </button>
            <form action={deleteTrackedLegislation}>
              <input type="hidden" name="id" value={legislation.id} />
              <button
                type="submit"
                className="rounded-full border border-coral/40 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-coral transition-colors hover:border-coral hover:bg-coral/10"
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-teal/40 bg-teal/[0.04] p-6">
      <form action={action}>
        <input type="hidden" name="id" value={legislation.id} />
        <div className="space-y-4">
          <TopicsPicker initial={topics} />
          <div>
            <label className={labelClass} htmlFor={`prompt-${legislation.id}`}>
              Research prompt
            </label>
            <textarea
              id={`prompt-${legislation.id}`}
              name="prompt"
              required
              rows={3}
              defaultValue={legislation.prompt}
              className={`mt-1 resize-y ${inputClass}`}
            />
          </div>
          <CadenceSelect
            name="cadence"
            defaultValue={legislation.cadence}
            idPrefix={legislation.id}
          />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              name="active"
              defaultChecked={legislation.active}
              className="h-4 w-4 accent-teal"
            />
            Active (send digests for this bill)
          </label>
        </div>

        {state?.error && (
          <p className="mt-4 font-mono text-xs text-coral" role="alert">
            {state.error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-teal px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a] disabled:pointer-events-none disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full border border-white/30 px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-white hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function CadenceSelect({
  name,
  defaultValue,
  idPrefix,
}: {
  name: string;
  defaultValue: Cadence;
  idPrefix: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={`cadence-${idPrefix}`}>
        Cadence
      </label>
      <select
        id={`cadence-${idPrefix}`}
        name={name}
        defaultValue={defaultValue}
        className={`mt-1 ${inputClass}`}
      >
        <option value="weekly">Weekly</option>
        <option value="daily">Daily</option>
      </select>
    </div>
  );
}
