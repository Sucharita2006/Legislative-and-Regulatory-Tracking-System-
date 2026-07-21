export type Bill = {
  id?: string;
  source_id: string;
  title: string;
  congress?: number;
  bill_type?: string;
  origin_chamber?: string;
  current_stage?: string | null;
  policy_area?: string | null;
  sponsor_name?: string | null;
  sponsor_party?: string | null;
  sponsor_state?: string | null;
  introduced_date?: string | null;
  last_action_date?: string | null;
  last_action_text?: string | null;
  source_url?: string | null;
  relevance_score?: number | null;
  prompt_score?: number | null;
  relevance_rationale?: string | null;
  relevance_topics?: string[];
  ai_summary?: string | null;
  ai_generated_at?: string | null;
  subjects?: string[];
  action_history?: { date: string; text: string; source: string }[];
  tags?: string[];
};

export type UserPrompt = {
  id: string;
  prompt_text: string;
  frequency: "daily" | "weekly";
  scope: "federal" | "priority_states" | "all_states";
  expanded_topics?: unknown;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  scope: string;
  review_bills: string[];
  prompts: UserPrompt[];
  is_verified: boolean;
  is_admin?: boolean;
};
