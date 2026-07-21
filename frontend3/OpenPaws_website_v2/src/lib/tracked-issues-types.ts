/** Client-safe types + constants for tracked issues. Kept separate from the
 *  data-access functions in `tracked-issues.ts`, which import server-only code
 *  (Supabase server client) and must never reach a client bundle. */

export const MAX_TRACKED_ISSUES = 5;

export type Cadence = "daily" | "weekly";

export type TrackedIssue = {
  id: string;
  title: string;
  prompt: string;
  cadence: Cadence;
  active: boolean;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Suggested key issues, shared by the Ask tab (fills the research prompt) and
 * the Digests "Track a new issue" form (fills the Title field).
 */
export const KEY_ISSUES = [
  { emoji: "⚖️", label: "Animal Law & Legal Cases" },
  { emoji: "📣", label: "Effective Advocacy" },
  { emoji: "✊", label: "Activism & Resistance" },
  { emoji: "🔄", label: "Systems Change & Transition" },
  { emoji: "🥩", label: "Food Industry Shifts" },
  { emoji: "🌱", label: "Alt Proteins & Food Tech" },
  { emoji: "🧠", label: "Animal Sentience & Cognition" },
  { emoji: "🔬", label: "Health & Science" },
  { emoji: "🦠", label: "Zoonotic Risk & Biosecurity" },
  { emoji: "🧪", label: "Animal Research & Testing" },
  { emoji: "🦌", label: "Wild Animal Welfare" },
  { emoji: "📊", label: "Public Opinion & Culture" },
  { emoji: "🏛️", label: "Politics & Policy" },
  { emoji: "🎪", label: "Animals in Entertainment" },
  { emoji: "🌍", label: "Climate & Environment" },
  { emoji: "🤖", label: "Emerging Tech & AI" },
  { emoji: "💰", label: "Investment & Market Trends" },
  { emoji: "👁️", label: "Surveillance & Repression" },
  { emoji: "🌎", label: "Animal Advocacy in Latin America" },
  { emoji: "🌍", label: "Animal Advocacy in Africa" },
  { emoji: "🌏", label: "Animal Advocacy in Asia" },
] as const;

export type KeyIssue = (typeof KEY_ISSUES)[number];

/**
 * A digest job can cover several topics. To avoid a schema change they are
 * stored joined in the existing `title` column and split back out for the UI.
 */
export const TOPICS_SEPARATOR = ", ";

export function parseTopics(stored: string): string[] {
  return stored
    .split(/\s*,\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function serializeTopics(topics: string[]): string {
  // De-dupe while preserving order.
  return [...new Set(topics.map((t) => t.trim()).filter(Boolean))].join(
    TOPICS_SEPARATOR,
  );
}
