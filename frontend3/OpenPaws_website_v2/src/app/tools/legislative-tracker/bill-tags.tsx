"use client";

import { useState } from "react";
import { TOPIC_CATEGORIES } from "@/lib/legislative-topics";

const SUGGESTED_TAGS = TOPIC_CATEGORIES.map(c => c.category);

async function tagFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`/api/user?path=${encodeURIComponent(path)}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...((options.headers as Record<string, string>) ?? {}) },
  });
  return res.json().catch(() => ({}));
}

export function BillTags({
  sourceId,
  userEmail,
  initialTags,
  onTagsChanged,
}: {
  sourceId: string;
  userEmail: string;
  initialTags: string[];
  onTagsChanged?: () => void;
}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  async function addTag(tagName: string) {
    const t = tagName.trim().toLowerCase();
    if (!t || tags.includes(t) || busy) return;
    setBusy(true);
    try {
      const data = await tagFetch(`/users/${userEmail}/bills/${sourceId}/tags`, {
        method: "POST",
        body: JSON.stringify({ tag: t }),
      });
      setTags(data.tags ?? [...tags, t]);
      setCustom("");
      setAdding(false);
      onTagsChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function removeTag(tagName: string) {
    if (busy) return;
    setBusy(true);
    try {
      const data = await tagFetch(`/users/${userEmail}/bills/${sourceId}/tags/${encodeURIComponent(tagName)}`, {
        method: "DELETE",
      });
      setTags(data.tags ?? tags.filter(t => t !== tagName));
      onTagsChanged?.();
    } finally {
      setBusy(false);
    }
  }

  const pickable = SUGGESTED_TAGS.filter(t => !tags.includes(t.toLowerCase()));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {tags.map(t => (
        <span
          key={t}
          className="flex items-center gap-1 rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs text-white/70"
        >
          {t}
          <button type="button" onClick={() => removeTag(t)} className="text-white/40 hover:text-white">×</button>
        </span>
      ))}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-white/20 px-2.5 py-0.5 text-xs text-white/40 hover:border-teal hover:text-white"
        >
          + Add tag
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {pickable.map(t => (
            <button
              key={t}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => addTag(t)}
              className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/60 hover:border-teal hover:text-white"
            >
              {t}
            </button>
          ))}
          <input
            autoFocus
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); void addTag(custom); }
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={() => { if (!custom) setAdding(false); }}
            placeholder="custom tag…"
            className="w-28 rounded-full border border-white/15 bg-black px-2.5 py-0.5 text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
