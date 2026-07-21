"use client";

import { useEffect, useState } from "react";

const BILL_TYPES = ["HR", "S", "HJRES", "SJRES", "HCONRES", "SCONRES", "HRES", "SRES"];

const DATE_PRESETS = [
  { label: "Any time", value: "" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "This Congress", value: "congress" },
  { label: "Custom range", value: "custom" },
] as const;

type SubjectGroup = { category: string; subjects: { name: string }[] };

export type SearchFilterValues = {
  subject: string;
  chamber: string;
  billType: string;
  congress: string;
  dateFrom: string;
  dateTo: string;
};

function computeDateRange(preset: string, sessionStart?: string): { from: string; to: string } {
  if (!preset || preset === "custom") return { from: "", to: "" };
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  if (preset === "congress") {
    return { from: sessionStart || "2025-01-03", to };
  }
  const days = parseInt(preset, 10);
  const from = new Date(now.getTime() - days * 86_400_000).toISOString().split("T")[0];
  return { from, to };
}

export function SearchFilters({
  values,
  onChange,
  onLoaded,
  tagFilter,
  onTagChange,
  tags,
  billCount,
}: {
  values: SearchFilterValues;
  onChange: (next: SearchFilterValues) => void;
  onLoaded?: () => void;
  tagFilter?: string;
  onTagChange?: (tag: string) => void;
  tags?: string[];
  billCount?: number;
}) {
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [datePreset, setDatePreset] = useState("");
  const [congressInfo, setCongressInfo] = useState<{ current_congress: number, session_start: string, available: number[] } | null>(null);

  useEffect(() => {
    // Fetch subjects
    fetch(`/api/bills?path=${encodeURIComponent("/subjects/grouped")}`)
      .then(r => r.json())
      .then(data => setSubjectGroups(Array.isArray(data) ? data : []))
      .catch(() => { /* filters just show no subject options if this fails */ });

    // Fetch current congress info
    fetch(`/api/bills?path=${encodeURIComponent("/congress/current")}`)
      .then(r => r.json())
      .then(data => setCongressInfo(data))
      .catch(() => { /* silent fail */ })
      .finally(() => onLoaded?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof SearchFilterValues>(key: K, value: SearchFilterValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handleDatePreset(preset: string) {
    setDatePreset(preset);
    if (preset !== "custom") {
      const { from, to } = computeDateRange(preset, congressInfo?.session_start);
      onChange({ ...values, dateFrom: from, dateTo: to });
    }
  }

  const hasActiveFilters = !!(values.subject || values.chamber || values.billType || values.congress || values.dateFrom || values.dateTo || tagFilter);

  function clearAll() {
    onChange({ subject: "", chamber: "", billType: "", congress: "", dateFrom: "", dateTo: "" });
    onTagChange?.("");
    setDatePreset("");
  }

  const selectClass = "h-9 rounded-lg border border-white/15 bg-white/[0.03] px-3 text-xs text-white focus:border-teal focus:outline-none";
  const dateInputClass = "h-9 rounded-lg border border-white/15 bg-white/[0.03] px-3 text-xs text-white focus:border-teal focus:outline-none";

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter icon */}
        <svg className="h-4 w-4 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>

        {/* Subject */}
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] text-white/50">Subject</label>
          <select value={values.subject} onChange={e => set("subject", e.target.value)} className={selectClass}>
            <option value="" className="bg-black text-white">All subjects</option>
            {subjectGroups.map(group => (
              <optgroup key={group.category} label={group.category} className="bg-black text-white font-semibold">
                {group.subjects.map(s => (
                  <option key={s.name} value={s.name} className="bg-black text-white font-normal">{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Chamber */}
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] text-white/50">Chamber</label>
          <select value={values.chamber} onChange={e => set("chamber", e.target.value)} className={selectClass}>
            <option value="" className="bg-black text-white">All chambers</option>
            <option value="House" className="bg-black text-white">House</option>
            <option value="Senate" className="bg-black text-white">Senate</option>
          </select>
        </div>

        {/* Bill type */}
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] text-white/50">Bill type</label>
          <select value={values.billType} onChange={e => set("billType", e.target.value)} className={selectClass}>
            <option value="" className="bg-black text-white">All types</option>
            {BILL_TYPES.map(t => (
              <option key={t} value={t} className="bg-black text-white">{t}</option>
            ))}
          </select>
        </div>

        {/* Congress */}
        {congressInfo && congressInfo.available && (
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] text-white/50">Congress</label>
            <select value={values.congress} onChange={e => set("congress", e.target.value)} className={selectClass}>
              <option value="" className="bg-black text-white">All Congresses</option>
              {congressInfo.available.map(c => (
                <option key={c} value={c} className="bg-black text-white">
                  {c}th {c === congressInfo.current_congress ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tag filter (merged in) */}
        {tags && tags.length > 0 && onTagChange && (
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] text-white/50">Tag</label>
            <select value={tagFilter ?? ""} onChange={e => onTagChange(e.target.value)} className={selectClass}>
              <option value="" className="bg-black text-white">All tags</option>
              {tags.map(t => (
                <option key={t} value={t} className="bg-black text-white">{t}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date range preset */}
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] text-white/50">Date range</label>
          <select value={datePreset} onChange={e => handleDatePreset(e.target.value)} className={selectClass}>
            {DATE_PRESETS.map(p => (
              <option key={p.value} value={p.value} className="bg-black text-white">{p.label}</option>
            ))}
          </select>
        </div>

        {/* Spacer to push count + clear to the right */}
        <div className="flex-1" />

        {/* Bill count */}
        {billCount != null && (
          <span className="text-xs text-white/50">
            Showing <span className="font-medium text-teal">{billCount}</span> bill{billCount !== 1 ? "s" : ""}
          </span>
        )}

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-white/50 hover:text-teal transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Custom date range pickers */}
      {datePreset === "custom" && (
        <div className="flex items-center gap-3 pl-7">
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] text-white/50">From</label>
            <input
              type="date"
              value={values.dateFrom}
              onChange={e => set("dateFrom", e.target.value)}
              className={dateInputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] text-white/50">To</label>
            <input
              type="date"
              value={values.dateTo}
              onChange={e => set("dateTo", e.target.value)}
              className={dateInputClass}
            />
          </div>
        </div>
      )}
    </div>
  );
}
