import "server-only";
import { createClient } from "@/lib/supabase/server";

const ALDF_BASE = (process.env.ALDF_BACKEND_URL ?? "").replace(/\/$/, "");

export function isAldfConfigured(): boolean {
  return Boolean(ALDF_BASE);
}

/** Get the email of the currently signed-in Supabase user. Returns null if not signed in. */
async function getCurrentEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

async function aldfRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  if (!ALDF_BASE) throw new Error("ALDF_BACKEND_URL is not configured.");
  return fetch(`${ALDF_BASE}${path}`, {
    ...options,
    redirect: "follow",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export type AldfPrompt = {
  id: string;
  prompt_text: string;
  frequency: "daily" | "weekly";
  expanded_topics: { topics?: string[]; keywords?: string[] } | null;
  created_at: string;
  updated_at: string;
};

export type AldfUserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  scope: string;
  review_bills: string[];
  prompts: AldfPrompt[];
  created_at: string;
  updated_at: string;
};

/** Ensure a user profile exists in the ALDF backend, creating it if needed. */
export async function ensureAldfUser(email: string): Promise<AldfUserProfile> {
  const res = await aldfRequest(`/users/${encodeURIComponent(email)}`);
  if (res.ok) return res.json();
  if (res.status !== 404) {
    throw new Error(`ALDF get user failed: ${res.status}`);
  }
  // User doesn't exist yet — create them.
  const createRes = await aldfRequest("/users", {
    method: "POST",
    body: JSON.stringify({ email, scope: "federal" }),
  });
  if (!createRes.ok) {
    throw new Error(`ALDF create user failed: ${createRes.status}`);
  }
  return createRes.json();
}

export async function listAldfPrompts(): Promise<AldfPrompt[]> {
  const email = await getCurrentEmail();
  if (!email) throw new Error("Not authenticated.");
  const profile = await ensureAldfUser(email);
  return profile.prompts;
}

export async function createAldfPrompt(
  promptText: string,
  frequency: "daily" | "weekly",
): Promise<AldfPrompt> {
  const email = await getCurrentEmail();
  if (!email) throw new Error("Not authenticated.");
  await ensureAldfUser(email);
  const res = await aldfRequest(
    `/users/${encodeURIComponent(email)}/prompts`,
    {
      method: "POST",
      body: JSON.stringify({ prompt_text: promptText, frequency }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ALDF create prompt failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function updateAldfPrompt(
  promptId: string,
  updates: Partial<{ prompt_text: string; frequency: "daily" | "weekly" }>,
): Promise<AldfPrompt> {
  const email = await getCurrentEmail();
  if (!email) throw new Error("Not authenticated.");
  const res = await aldfRequest(
    `/users/${encodeURIComponent(email)}/prompts/${encodeURIComponent(promptId)}`,
    {
      method: "PUT",
      body: JSON.stringify(updates),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ALDF update prompt failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function deleteAldfPrompt(promptId: string): Promise<void> {
  const email = await getCurrentEmail();
  if (!email) throw new Error("Not authenticated.");
  const res = await aldfRequest(
    `/users/${encodeURIComponent(email)}/prompts/${encodeURIComponent(promptId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`ALDF delete prompt failed: ${res.status}`);
  }
}
