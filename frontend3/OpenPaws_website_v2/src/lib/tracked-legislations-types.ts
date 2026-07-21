export const MAX_TRACKED_LEGISLATIONS = 5;

export type Cadence = "daily" | "weekly";

export type TrackedLegislation = {
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
 * Suggested legislative topics, shared by the Ask tab (fills the research prompt) and
 * the Digests "Track a new bill" form (fills the Title field).
 */
export const LEGISLATIVE_TOPICS = [
  { emoji: "🐾", label: "Cruelty & Enforcement" },
  { emoji: "🐄", label: "Farmed Animals & Food System" },
  { emoji: "🐕", label: "Companion Animals" },
  { emoji: "🐎", label: "Equines" },
  { emoji: "🦅", label: "Wildlife, ESA & Captivity" },
  { emoji: "🐋", label: "Marine Mammals & Fisheries" },
  { emoji: "🧪", label: "Animals in Research & Testing" },
  { emoji: "🌎", label: "Environmental / NEPA & Permitting" },
  { emoji: "⚖️", label: "Procedural & Administrative Law" },
] as const;


export type LegislativeTopic = (typeof LEGISLATIVE_TOPICS)[number];

export const TOPICS_SEPARATOR = ", ";

export function parseTopics(stored: string): string[] {
  return stored
    .split(/\s*,\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function serializeTopics(topics: string[]): string {
  return [...new Set(topics.map((t) => t.trim()).filter(Boolean))].join(
    TOPICS_SEPARATOR,
  );
}
