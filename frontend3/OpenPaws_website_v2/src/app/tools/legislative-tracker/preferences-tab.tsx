"use client";

import { useState, useEffect } from "react";
import { TOPIC_CATEGORIES } from "@/lib/legislative-topics";
import type { UserProfile, UserPrompt } from "./types";

const SCOPE_LABELS: Record<string, string> = {
  federal: "Federal Only",
  priority_states: "Priority States",
  all_states: "All States",
};

export function PreferencesTab({ user: initialUser }: { user: UserProfile }) {
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [testRunStatus, setTestRunStatus] = useState<Record<string, string>>({});
  const [digestHistory, setDigestHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/user?path=${encodeURIComponent(`/users/${encodeURIComponent(initialUser.email)}/digest-history`)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.logs) {
          setDigestHistory(data.logs);
        }
      })
      .catch(console.error);
  }, [initialUser.email]);

  // Prompt modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserPrompt | null>(null);
  const [modalText, setModalText] = useState("");
  const [modalFreq, setModalFreq] = useState<"daily" | "weekly">("daily");
  const [modalScope, setModalScope] = useState<"federal" | "priority_states" | "all_states">("federal");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // Proxy all user API calls through the Next.js server to avoid CORS + attach auth cookie.
  async function userFetch(path: string, options: RequestInit = {}) {
    const url = `/api/user?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...((options.headers as Record<string, string>) ?? {}) },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.detail || d.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function testDigest(promptId: string, frequency: "daily" | "weekly") {
    setTestRunStatus(s => ({ ...s, [promptId]: "sending" }));
    try {
      const endpoint = `/digest/send-test?email=${encodeURIComponent(user.email)}&frequency=${frequency}&prompt_id=${encodeURIComponent(promptId)}`;
      const res = await fetch(`/api/user?path=${encodeURIComponent(endpoint)}`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      setTestRunStatus(s => ({ ...s, [promptId]: "sent" }));
    } catch {
      setTestRunStatus(s => ({ ...s, [promptId]: "error" }));
    } finally {
      setTimeout(() => setTestRunStatus(s => { const n = { ...s }; delete n[promptId]; return n; }), 3000);
    }
  }

  function openAdd() {
    setEditing(null);
    setModalText("");
    setModalFreq("daily");
    setModalScope("federal");
    setModalError("");
    setModalOpen(true);
  }

  function openEdit(p: UserPrompt) {
    setEditing(p);
    setModalText(p.prompt_text);
    setModalFreq(p.frequency);
    setModalScope(p.scope);
    setModalError("");
    setModalOpen(true);
  }

  async function savePrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!modalText.trim()) return;
    setSaving(true);
    setModalError("");
    try {
      let updated: UserPrompt;
      if (editing) {
        updated = await userFetch(
          `/users/${encodeURIComponent(user.email)}/prompts/${encodeURIComponent(editing.id)}`,
          { method: "PUT", body: JSON.stringify({ prompt_text: modalText.trim(), frequency: modalFreq, scope: modalScope }) },
        );
        setUser(u => ({ ...u, prompts: u.prompts.map(p => p.id === editing.id ? updated : p) }));
      } else {
        const created = await userFetch(
          `/users/${encodeURIComponent(user.email)}/prompts`,
          { method: "POST", body: JSON.stringify({ prompt_text: modalText.trim(), frequency: modalFreq, scope: modalScope }) },
        );
        setUser(u => ({ ...u, prompts: [...u.prompts, created] }));
      }
      setModalOpen(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePrompt(promptId: string) {
    if (!window.confirm("Delete this tracking interest?")) return;
    try {
      await userFetch(
        `/users/${encodeURIComponent(user.email)}/prompts/${encodeURIComponent(promptId)}`,
        { method: "DELETE" },
      );
      setUser(u => ({ ...u, prompts: u.prompts.filter(p => p.id !== promptId) }));
    } catch {
      alert("Failed to delete.");
    }
  }

  return (
    <div className="space-y-8">

      {/* General Settings */}
      <div>
        <h3 className="text-sm font-semibold text-white">General Notification Settings</h3>
        <div className="mt-4 max-w-sm">
          <label className="block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40">Your Email</label>
          <input
            type="email"
            value={user.email}
            readOnly
            disabled
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white/50 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Tracking Interests */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Saved Tracking Interests</h3>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-full border border-teal px-4 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-teal hover:bg-teal/10"
          >
            + Add Interest
          </button>
        </div>
        <p className="mt-1 text-xs text-white/40">
          Each tracking interest is evaluated by our AI engine. Set the jurisdiction and cadence per interest.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {user.prompts.map(p => {
            const lastLog = digestHistory.find(log => log.prompt_id === p.id);
            return (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.15em] ${
                    p.frequency === "daily" ? "bg-teal/10 text-teal" : "bg-white/10 text-white/50"
                  }`}>
                    {p.frequency === "daily" ? "Daily" : "Weekly"}
                  </span>
                  <span className="inline-block rounded-full bg-white/5 px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-white/40">
                    {SCOPE_LABELS[p.scope] ?? p.scope}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{p.prompt_text}</p>
                
                {/* Digest History Row */}
                <div className="mt-4 border-t border-white/10 pt-3">
                  {lastLog ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className={lastLog.status === "sent" ? "text-teal" : "text-coral"}>
                        {lastLog.status === "sent" ? "✓ Sent" : "✕ Failed"}
                      </span>
                      <span className="text-white/40">•</span>
                      <span className="text-white/60">
                        {new Date(lastLog.sent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(lastLog.sent_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span className="text-white/40">•</span>
                      <span className="text-white/50">{lastLog.items_count} bill{lastLog.items_count !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/30 italic">Never sent</div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="rounded-full border border-white/20 px-3 py-1.5 font-mono text-[0.65rem] uppercase text-white/50 hover:border-white hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deletePrompt(p.id)}
                  className="rounded-full border border-red-400/30 px-3 py-1.5 font-mono text-[0.65rem] uppercase text-red-400 hover:border-red-400 hover:bg-red-400/10"
                >
                  Delete
                </button>
                {user.is_admin && (
                  <button
                    type="button"
                    disabled={testRunStatus[p.id] === "sending"}
                    onClick={() => testDigest(p.id, p.frequency)}
                    className={`rounded-full border px-3 py-1.5 font-mono text-[0.65rem] uppercase transition-colors disabled:opacity-40 ${
                      testRunStatus[p.id] === "sent"
                        ? "border-teal text-teal"
                        : testRunStatus[p.id] === "error"
                        ? "border-red-400 text-red-400"
                        : "border-white/20 text-white/50 hover:border-teal hover:text-teal"
                    }`}
                  >
                    {testRunStatus[p.id] === "sending"
                      ? "Sending…"
                      : testRunStatus[p.id] === "sent"
                      ? "Sent ✓"
                      : testRunStatus[p.id] === "error"
                      ? "Failed"
                      : "Test Run"}
                  </button>
                )}
              </div>
            </div>
          )})}

          <button
            type="button"
            onClick={openAdd}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-white/30 hover:border-teal hover:text-teal transition-colors"
          >
            <span className="text-2xl">+</span>
            <span className="font-mono text-xs uppercase">Add New Interest</span>
          </button>
        </div>
      </div>

      {/* Prompt Modal */}
      {modalOpen && (
        <PromptModal
          editing={editing}
          initialText={modalText}
          initialFreq={modalFreq}
          initialScope={modalScope}
          error={modalError}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSubmit={savePrompt}
          onTextChange={setModalText}
          onFreqChange={setModalFreq}
          onScopeChange={setModalScope}
        />
      )}
    </div>
  );
}

function PromptModal({
  editing,
  initialText,
  initialFreq,
  initialScope,
  error,
  saving,
  onClose,
  onSubmit,
  onTextChange,
  onFreqChange,
  onScopeChange,
}: {
  editing: UserPrompt | null;
  initialText: string;
  initialFreq: "daily" | "weekly";
  initialScope: "federal" | "priority_states" | "all_states";
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onTextChange: (v: string) => void;
  onFreqChange: (v: "daily" | "weekly") => void;
  onScopeChange: (v: "federal" | "priority_states" | "all_states") => void;
}) {
  // Track which category chips are toggled on
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    TOPIC_CATEGORIES.forEach(c => {
      if (initialText.includes(c.category)) s.add(c.category);
    });
    return s;
  });

  function toggleCategory(category: string) {
    const next = new Set(selected);
    if (next.has(category)) {
      next.delete(category);
      const lines = initialText
        .split(",")
        .map(s => s.trim())
        .filter(s => s !== category);
      onTextChange(lines.join(", "));
    } else {
      next.add(category);
      const existing = initialText.trim();
      onTextChange(existing ? `${existing}, ${category}` : category);
    }
    setSelected(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-xl max-h-[90vh] flex-col rounded-2xl border border-white/10 bg-black">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">
            {editing ? "Edit Tracking Interest" : "Add Tracking Interest"}
          </h3>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          <form id="prompt-form" onSubmit={onSubmit} className="space-y-5">

            {/* Category chips */}
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40 mb-2">
                Select topics
              </label>
              <p className="mb-3 text-xs text-white/30">Click to add a topic to your prompt. You can also write freely below.</p>
              <div className="flex flex-wrap gap-2">
                {TOPIC_CATEGORIES.map(cat => {
                  const on = selected.has(cat.category);
                  return (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => toggleCategory(cat.category)}
                      className={`rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors ${
                        on
                          ? "border-teal bg-teal/10 text-white"
                          : "border-white/15 text-white/60 hover:border-teal/60 hover:text-white"
                      }`}
                    >
                      <span className="mr-1.5">{cat.emoji}</span>{cat.category}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt textarea */}
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40 mb-1.5">
                Prompt <span className="text-teal">*</span>
              </label>
              <textarea
                rows={4}
                value={initialText}
                onChange={e => onTextChange(e.target.value)}
                placeholder="e.g. Cruelty & Enforcement, Farmed Animals & Food System"
                required
                className="w-full resize-y rounded-lg border border-white/15 bg-black px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
              />
            </div>

            {/* Frequency + Jurisdiction row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40 mb-1.5">
                  Digest Frequency
                </label>
                <select
                  value={initialFreq}
                  onChange={e => onFreqChange(e.target.value as "daily" | "weekly")}
                  className="w-full rounded-lg border border-white/15 bg-black px-4 py-2.5 text-sm text-white focus:border-teal focus:outline-none"
                >
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40 mb-1.5">
                  Jurisdiction
                </label>
                <select
                  value={initialScope}
                  onChange={e => onScopeChange(e.target.value as "federal" | "priority_states" | "all_states")}
                  className="w-full rounded-lg border border-white/15 bg-black px-4 py-2.5 text-sm text-white focus:border-teal focus:outline-none"
                >
                  <option value="federal">Federal Only</option>
                  <option value="priority_states">Priority States</option>
                  <option value="all_states">All States</option>
                </select>
              </div>
            </div>

            {error && <p className="font-mono text-xs text-coral">{error}</p>}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-4 py-2 font-mono text-xs uppercase text-white/50 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="prompt-form"
            disabled={saving}
            className="rounded-full bg-teal px-5 py-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal hover:bg-[#00807a] disabled:opacity-40"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Interest"}
          </button>
        </div>
      </div>
    </div>
  );
}
