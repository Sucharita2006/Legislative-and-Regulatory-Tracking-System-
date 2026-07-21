"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LEGISLATIVE_TOPICS } from "@/lib/tracked-legislations-types";
import { BillCard } from "./bill-card";
import { TagFilter } from "./tag-filter";
import { SearchFilters, type SearchFilterValues } from "./search-filters";
import { useFilteredBills } from "./use-filtered-bills";
import type { Bill } from "./types";

const EMPTY_SEARCH_FILTERS: SearchFilterValues = { subject: "", chamber: "", billType: "", congress: "", dateFrom: "", dateTo: "" };
const INITIAL_VISIBLE_TOPICS = 5;

/* ── helpers ────────────────────────────────────────────────────── */

function toggleTopic(prompt: string, topic: string): string {
  const lines = prompt.split("\n");
  const topicsLineIdx = lines.findIndex(l => l.trim().startsWith("Topics:"));
  let existing: string[] = [];

  if (topicsLineIdx !== -1) {
    existing = lines[topicsLineIdx]
      .replace("Topics:", "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    lines.splice(topicsLineIdx, 1);
  }

  const body = lines.join("\n").trimEnd();
  const next = existing.includes(topic)
    ? existing.filter(t => t !== topic)
    : [...existing, topic];

  if (next.length === 0) return body;
  return `${body ? body + "\n\n" : ""}Topics: ${next.join(", ")}`;
}

function promptHasTopic(prompt: string, topic: string) {
  const m = prompt.match(/Topics:\s*(.*)/);
  if (!m) return false;
  return m[1].split(",").map(t => t.trim()).includes(topic);
}

function getSelectedTopics(prompt: string): string[] {
  const m = prompt.match(/Topics:\s*(.*)/);
  if (!m) return [];
  return m[1].split(",").map(t => t.trim()).filter(Boolean);
}

function getPromptBody(prompt: string): string {
  const lines = prompt.split("\n");
  const topicsLineIdx = lines.findIndex(l => l.trim().startsWith("Topics:"));
  if (topicsLineIdx !== -1) {
    const bodyLines = lines.slice(0, topicsLineIdx);
    // Remove blank lines preceding the Topics line
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
      bodyLines.pop();
    }
    return bodyLines.join("\n");
  }
  return prompt;
}

function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.indexOf("Win") !== -1;
}

/* ── component ──────────────────────────────────────────────────── */

export function AskTab({
  userEmail,
  reviewBills,
  onToggleReview,
}: {
  userEmail: string;
  reviewBills: Set<string>;
  onToggleReview: (sourceId: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [dateEnabled, setDateEnabled] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [running, setRunning] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllTopics, setShowAllTopics] = useState(false);

  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagsRefreshSignal, setTagsRefreshSignal] = useState(0);
  const [searchFilters, setSearchFilters] = useState<SearchFilterValues>(EMPTY_SEARCH_FILTERS);
  const [searchResultFilters, setSearchResultFilters] = useState<SearchFilterValues>(EMPTY_SEARCH_FILTERS);
  const filteredBills = useFilteredBills(bills, searchResultFilters);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);
  const [initialReady, setInitialReady] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!recentLoading && tagsLoaded && subjectsLoaded) setInitialReady(true);
  }, [recentLoading, tagsLoaded, subjectsLoaded]);

  /* auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 64) + "px";
  }, [prompt]);

  /* fetch recent bills */
  useEffect(() => {
    const params = new URLSearchParams({
      sort_by: "last_action_date",
      order: "desc",
      limit: "20",
      user_email: userEmail,
    });
    if (tagFilter) params.set("tag", tagFilter);
    if (searchFilters.subject) params.set("subject", searchFilters.subject);
    if (searchFilters.billType) params.set("bill_type", searchFilters.billType);
    if (searchFilters.dateFrom) params.set("from_action_date", searchFilters.dateFrom);
    if (searchFilters.dateTo) params.set("to_action_date", searchFilters.dateTo);
    const backendPath = `/documents/search?${params}`;
    setRecentLoading(true);
    fetch(`/api/bills?path=${encodeURIComponent(backendPath)}`)
      .then(r => r.json())
      .then(data => {
        const results: Bill[] = data.results || [];
        setRecentBills(
          searchFilters.chamber
            ? results.filter(b => (b.origin_chamber || "House").toLowerCase() === searchFilters.chamber.toLowerCase())
            : results
        );
      })
      .catch(() => { /* silently ignore */ })
      .finally(() => setRecentLoading(false));
  }, [userEmail, tagFilter, searchFilters]);

  /* search handler */
  async function run(e: React.FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q || running) return;

    setRunning(true);
    setError(null);
    setBills([]);
    setTopics([]);
    setSearched(false);
    setSearchResultFilters(EMPTY_SEARCH_FILTERS);

    try {
      const res = await fetch("/api/legislative-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          date: dateEnabled ? date : null,
          user_email: userEmail,
        }),
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status}).`;
        try { const d = await res.json(); if (d?.error) msg = d.error; } catch { /* ignore */ }
        setError(msg);
        return;
      }

      const data = await res.json();
      const results: Bill[] = (data.results || [])
        .filter((b: Bill) => b.prompt_score != null && b.prompt_score >= 20)
        .sort((a: Bill, b: Bill) => (b.prompt_score ?? 0) - (a.prompt_score ?? 0))
        .slice(0, 20);

      setBills(results);
      setTopics(data.prompt_expansion?.topics || []);
      setSearched(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  const selectedTopics = useMemo(() => getSelectedTopics(prompt), [prompt]);
  const promptBody = useMemo(() => getPromptBody(prompt), [prompt]);
  const shortcutKey = isWindows() ? "Ctrl" : "⌘";

  const visibleTopics = showAllTopics
    ? LEGISLATIVE_TOPICS
    : LEGISLATIVE_TOPICS.slice(0, INITIAL_VISIBLE_TOPICS);
  const hiddenCount = LEGISLATIVE_TOPICS.length - INITIAL_VISIBLE_TOPICS;

  /* card styling constants */
  const cardClass = "rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6";

  return (
    <div className="space-y-5">
      {/* ═══════════ CARD 1 — Search Congress.gov ═══════════ */}
      <div className={cardClass}>
        <div className="mb-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <svg className="h-5 w-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search Congress.gov
          </h3>
          <p className="mt-1 text-sm text-white/50">
            Ask in plain language, or pick topics below. Results come live from Congress.gov.
          </p>
        </div>

        <form onSubmit={run} className="space-y-4">
          {/* Selected topic pills */}
          {selectedTopics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTopics.map(t => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-full bg-teal/15 border border-teal/30 px-2.5 py-1 text-xs font-medium text-teal"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setPrompt(p => toggleTopic(p, t))}
                    className="ml-0.5 text-teal/60 hover:text-teal transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Textarea (shows only body, topics shown as pills above) */}
          <textarea
            ref={textareaRef}
            value={promptBody}
            onChange={e => {
              const body = e.target.value;
              const topicsPart = selectedTopics.length > 0
                ? `\n\nTopics: ${selectedTopics.join(", ")}`
                : "";
              setPrompt(body + topicsPart);
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(e); }
            }}
            rows={2}
            placeholder="e.g., Bills about factory farming disclosure requirements"
            disabled={running}
            className="w-full resize-none overflow-hidden rounded-lg border border-white/15 bg-black px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
          />

          {/* Topic chips */}
          <div>
            <p className="mb-2 text-xs text-white/50">Or pick topics to search</p>
            <div className="flex flex-wrap gap-2">
              {visibleTopics.map(({ emoji, label }) => {
                const selected = promptHasTopic(prompt, label);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={running}
                    onClick={() => setPrompt(p => toggleTopic(p, label))}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                      selected
                        ? "border-teal bg-teal/15 text-teal font-medium"
                        : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/70"
                    }`}
                  >
                    <span className="mr-1">{emoji}</span>{label}
                  </button>
                );
              })}
              {!showAllTopics && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllTopics(true)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/40 hover:border-white/25 hover:text-white/60 transition-colors"
                >
                  +{hiddenCount} more
                </button>
              )}
            </div>
          </div>

          {/* Advanced options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(a => !a)}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Advanced options {showAdvanced ? "▴" : "▾"}
            </button>
            {showAdvanced && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3">
                <label className="flex items-center gap-2 text-sm text-white/60">
                  <input
                    type="checkbox"
                    checked={dateEnabled}
                    onChange={e => setDateEnabled(e.target.checked)}
                    className="accent-teal"
                  />
                  Filter by action date
                </label>
                {dateEnabled && (
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="h-9 rounded-lg border border-white/15 bg-black px-3 text-xs text-white focus:border-teal focus:outline-none"
                  />
                )}
              </div>
            )}
          </div>

          {/* Search button + keyboard hint */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={running || !prompt.trim()}
              className="flex items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-sm font-medium text-on-teal transition-colors hover:bg-[#00807a] disabled:pointer-events-none disabled:opacity-40"
            >
              {running && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {running ? "Searching…" : "Search Live"}
            </button>
            <span className="text-[0.65rem] text-white/25">{shortcutKey} + Enter</span>
          </div>
        </form>

        {/* Error */}
        {error && (
          <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Expanded topics */}
        {topics.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.01] p-3">
            <span className="text-xs text-white/40">Expanded topics:</span>
            {topics.map(t => (
              <span key={t} className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs text-white/70">{t}</span>
            ))}
          </div>
        )}

        {/* Search results (rendered inside Card 1) */}
        {searched && bills.length === 0 && (
          <div className="mt-6 rounded-lg border border-white/5 bg-white/[0.01] p-6 text-center">
            <p className="text-sm text-white/50">No bills matched your search.</p>
            <p className="mt-1 text-xs text-white/30">Try broadening your topics or using different keywords.</p>
            <button
              type="button"
              onClick={() => { setSearched(false); setPrompt(""); }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-teal hover:text-teal/80 transition-colors"
            >
              <span>←</span> Clear search
            </button>
          </div>
        )}

        {searched && bills.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-white/30">Search results</span>
              <button
                type="button"
                onClick={() => { setSearched(false); setPrompt(""); }}
                className="inline-flex items-center gap-1.5 text-xs text-teal hover:text-teal/80 transition-colors"
              >
                <span>←</span> Clear search
              </button>
            </div>

            {/* Reusable filter bar */}
            <SearchFilters
              values={searchResultFilters}
              onChange={setSearchResultFilters}
              billCount={filteredBills.length}
            />

            {filteredBills.length === 0 ? (
              <div className="rounded-lg border border-white/5 bg-white/[0.01] p-6 text-center">
                <p className="text-sm text-white/50">No bills matched your filters.</p>
                <p className="mt-1 text-xs text-white/30">Try adjusting your filters or clearing them to see all results.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBills.map(bill => (
                  <BillCard
                    key={bill.source_id}
                    bill={bill}
                    scoreLabel="Relevance"
                    userEmail={userEmail}
                    showTrackButton
                    isTracked={reviewBills.has(bill.source_id)}
                    onToggleTrack={b => onToggleReview(b.source_id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ CARD 2 — Recent legislative actions ═══════════ */}
      {!searched && !running && (
        <div className={cardClass}>
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <svg className="h-5 w-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Recent legislative actions
            </h3>
            <p className="mt-1 text-sm text-white/50">
              Browse the latest activity. Filters apply instantly.
            </p>
          </div>

          {/* Headless tag fetcher */}
          <TagFilter
            userEmail={userEmail}
            value={tagFilter}
            onChange={setTagFilter}
            refreshSignal={tagsRefreshSignal}
            onLoaded={() => setTagsLoaded(true)}
            onTagsLoaded={setAvailableTags}
          />

          <div className={initialReady ? "space-y-4" : "hidden"}>
            {/* Unified filter bar */}
            <SearchFilters
              values={searchFilters}
              onChange={setSearchFilters}
              onLoaded={() => setSubjectsLoaded(true)}
              tagFilter={tagFilter}
              onTagChange={setTagFilter}
              tags={availableTags}
              billCount={recentLoading ? undefined : recentBills.length}
            />

            {recentLoading && (
              <div className="flex items-center gap-2 text-sm text-white/40">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-teal" />
                Updating results…
              </div>
            )}

            {!recentLoading && recentBills.length === 0 && (
              <div className="rounded-lg border border-white/5 bg-white/[0.01] p-6 text-center">
                <p className="text-sm text-white/50">No recent legislative actions found.</p>
                <p className="mt-1 text-xs text-white/30">Try adjusting your filters or broadening the date range.</p>
              </div>
            )}

            {!recentLoading && recentBills.map(bill => (
              <BillCard
                key={bill.source_id}
                bill={bill}
                userEmail={userEmail}
                onTagsChanged={() => setTagsRefreshSignal(s => s + 1)}
                showTrackButton
                isTracked={reviewBills.has(bill.source_id)}
                onToggleTrack={b => onToggleReview(b.source_id)}
              />
            ))}
          </div>

          {!initialReady && (
            <div className="flex items-center gap-2 text-sm text-white/40">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-teal" />
              Loading recent legislative actions…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
