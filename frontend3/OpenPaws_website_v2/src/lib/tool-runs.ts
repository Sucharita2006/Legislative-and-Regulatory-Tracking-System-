import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Async tool runs. Long n8n workflows (legal-research, org-research) outlive a
 * serverless function, so we don't hold the HTTP connection open. A trigger
 * route inserts a `pending` row and fires n8n; n8n posts back to the callback
 * route on completion; the browser polls the status route until terminal.
 *
 * See supabase/schema.sql (`tool_runs`) for the table and RLS rules.
 */

export type ToolRunStatus = "pending" | "done" | "error";

export type ToolRun = {
  id: string;
  tool: string;
  status: ToolRunStatus;
  email: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

const COLUMNS =
  "id, tool, status, email, result, error, created_at, completed_at";

/**
 * How long a run may stay `pending` before we assume the n8n callback is never
 * coming (workflow crashed, callback URL unreachable, …). Real runs take up to
 * ~20 minutes; anything past this is lost, and without it a dead run shows
 * "In progress" forever and the browser polls it indefinitely.
 */
const RUN_TIMEOUT_MS = 45 * 60 * 1000;

const RUN_TIMEOUT_ERROR =
  "The research service never reported back — the run timed out. Please try again.";

function isStalePending(run: Pick<ToolRun, "status" | "created_at">): boolean {
  return (
    run.status === "pending" &&
    Date.now() - new Date(run.created_at).getTime() > RUN_TIMEOUT_MS
  );
}

/**
 * Self-healing for lost runs: whenever stale pending rows are read (status
 * poll or history panel), mark them errored in the DB and return them as such,
 * so the UI stops saying "In progress" and the poller stops. completeToolRun
 * only flips rows still `pending`, so this can't clobber a result from a
 * callback that lands concurrently.
 */
async function expireIfStale<T extends ToolRun>(run: T): Promise<T> {
  if (!isStalePending(run)) return run;
  try {
    await completeToolRun(run.id, { error: RUN_TIMEOUT_ERROR });
  } catch {
    // If the write fails, still report the run as timed out to the caller.
  }
  return {
    ...run,
    status: "error" as const,
    error: RUN_TIMEOUT_ERROR,
    completed_at: run.completed_at ?? new Date().toISOString(),
  };
}

/**
 * Create a pending run for the current user. Uses the request-scoped client so
 * RLS ties the row to the signed-in user. Returns the new run's id.
 */
export async function createToolRun(
  tool: string,
  input: unknown,
): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("tool_runs")
    .insert({ user_id: user.id, email: user.email ?? null, tool, input: input ?? {} })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * A run as shown in a tool's history panel — includes the original `input`
 * so the UI can label each entry (e.g. the prompt or company name).
 */
export type ToolRunListItem = ToolRun & { input: Record<string, unknown> };

/**
 * List the current user's past runs of one tool, newest first. RLS scopes the
 * query to their own rows, so no explicit user filter is needed. Runs the user
 * removed from their history (`hidden`) are excluded.
 */
export async function listToolRuns(
  tool: string,
  limit = 25,
): Promise<ToolRunListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tool_runs")
    .select(`${COLUMNS}, input`)
    .eq("tool", tool)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Promise.all(
    ((data ?? []) as ToolRunListItem[]).map((run) => expireIfStale(run)),
  );
}

/**
 * Hide a run from the current user's history (soft delete). The row is kept —
 * it's a permanent log — only the `hidden` flag flips. Users have no update
 * policy on tool_runs (so results can't be forged from the browser), so after
 * confirming the signed-in user owns the run (request-scoped select under RLS)
 * the flag is written with the service role. Returns false if the run isn't
 * theirs / doesn't exist.
 */
export async function hideToolRun(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tool_runs")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return false;

  const admin = createAdminClient();
  const { error } = await admin
    .from("tool_runs")
    .update({ hidden: true })
    .eq("id", id);
  if (error) throw error;
  return true;
}

/** Fetch one run owned by the current user, or null. RLS scopes it to them. */
export async function getToolRun(id: string): Promise<ToolRun | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tool_runs")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  const run = (data as ToolRun | null) ?? null;
  return run ? expireIfStale(run) : null;
}

/**
 * Mark a run terminal. Called from the callback route on n8n's behalf, so it
 * uses the service-role client (n8n has no user session — the route first
 * authorizes it via the shared secret or the run-id capability). Only flips
 * rows still `pending`, so a duplicate callback can't overwrite an
 * already-recorded result.
 */
export async function completeToolRun(
  id: string,
  outcome: { result: string } | { error: string },
): Promise<boolean> {
  const admin = createAdminClient();
  const patch =
    "result" in outcome
      ? { status: "done" as const, result: outcome.result, error: null }
      : { status: "error" as const, error: outcome.error, result: null };

  const { data, error } = await admin
    .from("tool_runs")
    .update({ ...patch, completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Absolute origin of the current request, for building the callback URL. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Start an async run: create a pending row, then fire the n8n webhook with the
 * caller's input plus `runId` and `callbackUrl` so n8n can post the result back
 * to /api/tool-runs/callback when it finishes.
 *
 * We do NOT await the workflow to completion — it can run far longer than the
 * function may live. We only await long enough to confirm n8n accepted the
 * request:
 *   - n8n's webhook responds only when the workflow ends, so our short timeout
 *     firing (TimeoutError) is the EXPECTED success path: "accepted, running".
 *   - A genuine connection error means n8n is unreachable, so we mark the run
 *     errored and surface the failure.
 *
 * Returns the run id the browser should poll.
 */
export async function startToolRun({
  tool,
  webhookUrl,
  input,
}: {
  tool: string;
  webhookUrl: string;
  input: Record<string, unknown>;
}): Promise<string> {
  const runId = await createToolRun(tool, input);
  const callbackUrl = `${await requestOrigin()}/api/tool-runs/callback`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // callbackSecret rides along so the workflow can echo it back as the
      // callback's `secret` body field, instead of every workflow keeping its
      // own copy of TOOL_RUNS_CALLBACK_SECRET in an HTTP-Request node.
      body: JSON.stringify({
        ...input,
        runId,
        callbackUrl,
        callbackSecret: process.env.TOOL_RUNS_CALLBACK_SECRET ?? "",
      }),
      // Just long enough to catch an immediate connection failure. n8n won't
      // respond before then (it runs for minutes), so a timeout = accepted.
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    if ((err as Error)?.name === "TimeoutError") {
      // Expected: n8n took the request and is now working. Leave it pending.
      return runId;
    }
    // Couldn't reach n8n at all — mark the run errored so the poller stops.
    await completeToolRun(runId, {
      error: "Couldn't reach the research service. Please try again.",
    });
    throw new Error("WEBHOOK_UNREACHABLE");
  }

  // n8n responded synchronously within the window (e.g. it's in
  // "respond immediately" mode). The run stays pending until the callback
  // arrives, which is correct.
  return runId;
}
