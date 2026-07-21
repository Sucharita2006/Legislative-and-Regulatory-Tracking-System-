import { NextResponse, type NextRequest } from "next/server";
import { completeToolRun } from "@/lib/tool-runs";
import { createAdminClient } from "@/lib/supabase/admin";

// Shared secret n8n may present to record a result. Set in Vercel env and in
// each n8n workflow's final HTTP-Request node. Optional: callers that don't
// send it are authorized by capability instead (a valid, still-pending run id).
const CALLBACK_SECRET = process.env.TOOL_RUNS_CALLBACK_SECRET;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

/**
 * Completion callback for async tool runs. The n8n workflow POSTs here when it
 * finishes, with the run id and either a `result` (markdown or JSON-encoded
 * text) or an `error` message. We flip the matching row to its terminal state;
 * the browser is polling /api/tool-runs/{id} and picks it up.
 *
 * Authorization accepts either of:
 *   1. The shared secret, in the `x-callback-secret` header or the JSON body's
 *      `secret` field.
 *   2. The run id as a capability (mirrors /api/cron/digests/callback): the
 *      `runId` is a random UUID that only ever travels trigger → n8n → here,
 *      so presenting a valid, still-`pending` id is itself proof the caller is
 *      the workflow we invoked.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const runId = String(body?.runId ?? body?.run_id ?? "").trim();
  if (!runId) {
    return NextResponse.json({ error: "Missing runId." }, { status: 400 });
  }
  if (!UUID_RE.test(runId)) {
    return NextResponse.json({ error: "Invalid runId." }, { status: 400 });
  }

  const provided =
    request.headers.get("x-callback-secret") ?? String(body?.secret ?? "");
  const secretOk = Boolean(CALLBACK_SECRET) && provided === CALLBACK_SECRET;

  if (!secretOk) {
    // No (or wrong) secret — fall back to the run-id capability check: the id
    // must belong to an existing, still-pending run.
    const admin = createAdminClient();
    const { data: run, error: runErr } = await admin
      .from("tool_runs")
      .select("id, status")
      .eq("id", runId)
      .maybeSingle();
    if (runErr) {
      console.error("[tool-runs/callback] failed to load run:", runErr.message);
      return NextResponse.json(
        { error: "Failed to load run.", detail: runErr.message },
        { status: 500 },
      );
    }
    if (!run) {
      // Neither a valid secret nor a known run id.
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (run.status !== "pending") {
      // Already settled (e.g. a duplicate callback) — no-op, 200 so n8n
      // doesn't retry a finished run.
      return NextResponse.json({ ok: true, updated: false });
    }
  }

  // An explicit error wins; otherwise treat the payload as a result. n8n may
  // send the result as a string or an object, under any of the common field
  // names (the shared research workflow uses `report`, same as the digests
  // callback) — stringify objects so the column (text) always gets text; the
  // client decodes structured tools' JSON.
  const errMsg = body?.error;
  let outcome: { result: string } | { error: string };
  if (typeof errMsg === "string" && errMsg.trim()) {
    outcome = { error: errMsg.trim() };
  } else {
    const raw =
      body?.result ?? body?.output ?? body?.text ?? body?.report ?? body?.markdown;
    const result =
      typeof raw === "string" ? raw : raw == null ? "" : JSON.stringify(raw);
    if (!result.trim()) {
      return NextResponse.json(
        { error: "Missing result or error." },
        { status: 400 },
      );
    }
    outcome = { result };
  }

  let updated: boolean;
  try {
    updated = await completeToolRun(runId, outcome);
  } catch (err) {
    // Surface the underlying cause — almost always a missing
    // SUPABASE_SERVICE_ROLE_KEY env var or the tool_runs table not existing.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[tool-runs/callback] completeToolRun failed:", detail);
    return NextResponse.json(
      { error: "Failed to record result.", detail },
      { status: 500 },
    );
  }

  // Not updated → unknown id or already-terminal run (e.g. a duplicate
  // callback). 200 either way so n8n doesn't retry a settled run.
  return NextResponse.json({ ok: true, updated });
}
