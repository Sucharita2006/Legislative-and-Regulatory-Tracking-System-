import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS, so it can read every user's rows
 * and write on their behalf — used only by trusted server jobs (the digest
 * cron). NEVER import this into client code or expose the key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
