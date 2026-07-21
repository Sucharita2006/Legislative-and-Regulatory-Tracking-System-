import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDigestPrompt, fireDigestResearch } from "@/lib/research";
import { isMailerConfigured } from "@/lib/mailer";
import { logCronRun, type CronItemError } from "@/lib/cron-log";
import type { Cadence } from "@/lib/tracked-issues";

const JOB = "digests";

// Secret Vercel Cron sends as `Authorization: Bearer <CRON_SECRET>`. The same
// value lets an external trigger (e.g. GitHub Actions) authenticate.
const CRON_SECRET = process.env.CRON_SECRET;

// nodemailer needs the Node.js runtime (not edge). The callback that sends the
// email also runs on Node; this route only triggers n8n and returns, so it no
// longer strictly needs Node — but keep it consistent with the callback.
export const runtime = "nodejs";
// We no longer await the research. Per due issue we insert a pending
// digest_runs row and fire the n8n webhook (which calls back when done), so
// this route returns in seconds regardless of how long research takes. A short
// cap is plenty; the old 800s was only needed while we blocked on n8n.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// How stale last_sent_at must be before an issue is due again. A 12h grace
// margin keeps a row from being skipped when the cron fires a little early.
const DUE_AFTER_MS: Record<Cadence, number> = {
  daily: 12 * 60 * 60 * 1000, // ~half a day
  weekly: 6.5 * 24 * 60 * 60 * 1000, // ~6.5 days
};

type DueIssue = {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  cadence: Cadence;
  last_sent_at: string | null;
  email: string;
};

function isDue(cadence: Cadence, lastSentAt: string | null, now: number): boolean {
  if (!lastSentAt) return true;
  return now - new Date(lastSentAt).getTime() >= DUE_AFTER_MS[cadence];
}

/** Absolute origin of this request, for building the n8n callback URL. */
function requestOrigin(request: NextRequest): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/**
 * Digest cron. Vercel Cron (or GitHub Actions) hits this daily. For every
 * tracked issue that is due (per its daily/weekly cadence and last_sent_at) we
 * insert a `pending` digest_runs row and FIRE the n8n research webhook without
 * awaiting it — the route returns in seconds. When n8n finishes it POSTs the
 * report to /api/cron/digests/callback, which stores it, emails it, and stamps
 * last_sent_at. Each issue is triggered independently: if triggering one fails,
 * its row is marked errored and it keeps its old last_sent_at, so it retries on
 * the next run.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "Cron is not configured (missing CRON_SECRET)." },
      { status: 503 },
    );
  }
  // Vercel Cron authenticates with `Authorization: Bearer <CRON_SECRET>`.
  if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isMailerConfigured()) {
    await logCronRun({
      job: JOB,
      due: 0,
      sent: 0,
      failed: 1,
      detail: "Email is not configured (missing SMTP_* env vars).",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Email is not configured (missing SMTP_* env vars)." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();

  // Pull active issues. We can't embed profiles(email) here: tracked_issues has
  // no FK to profiles (both only FK to auth.users), so PostgREST rejects the
  // join with a 400. Instead fetch issues, then look up emails by user_id.
  const { data, error } = await supabase
    .from("tracked_issues")
    .select("id, user_id, title, prompt, cadence, last_sent_at")
    .eq("active", true);
  if (error) {
    console.error("Digest cron: failed to load tracked issues:", error);
    await logCronRun({
      job: JOB,
      due: 0,
      sent: 0,
      failed: 1,
      detail: `Could not load tracked issues: ${error.message}`,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Could not load tracked issues.", detail: error.message },
      { status: 500 },
    );
  }

  const rows = data ?? [];

  // Resolve owner emails (and org settings, for tailoring the research prompt)
  // in one query, then join in JS.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const emailByUser = new Map<string, string>();
  const orgContextByUser = new Map<string, string>();
  if (userIds.length) {
    // The org-settings columns may not be migrated yet — digests must keep
    // flowing regardless, so fall back to the pre-migration shape. The two
    // selects infer different row types, hence the explicit common shape.
    type ProfileRow = {
      id: string;
      email: string | null;
      organization?: string | null;
      custom_prompt?: string | null;
    };
    let { data: profiles, error: profErr } = (await supabase
      .from("profiles")
      .select("id, email, organization, custom_prompt")
      .in("id", userIds)) as { data: ProfileRow[] | null; error: { message: string } | null };
    if (profErr) {
      ({ data: profiles, error: profErr } = (await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds)) as { data: ProfileRow[] | null; error: { message: string } | null });
    }
    if (profErr) {
      console.error("Digest cron: failed to load profiles:", profErr);
      await logCronRun({
        job: JOB,
        due: 0,
        sent: 0,
        failed: 1,
        detail: `Could not load profiles: ${profErr.message}`,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Could not load profiles.", detail: profErr.message },
        { status: 500 },
      );
    }
    for (const p of profiles ?? []) {
      if (p.email) emailByUser.set(p.id, p.email);
      // Same org context the interactive tools send (see lib/org-settings.ts),
      // rendered as extra instruction text for the research prompt.
      const organization =
        typeof p.organization === "string" ? p.organization.trim() : "";
      const customPrompt =
        typeof p.custom_prompt === "string" ? p.custom_prompt.trim() : "";
      const context = [
        organization ? `The user advocates with the organization: ${organization}.` : "",
        customPrompt,
      ]
        .filter(Boolean)
        .join("\n");
      if (context) orgContextByUser.set(p.id, context);
    }
  }

  const now = Date.now();
  const due: DueIssue[] = rows
    .map((row): DueIssue => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      prompt: row.prompt,
      cadence: row.cadence,
      last_sent_at: row.last_sent_at,
      email: emailByUser.get(row.user_id) ?? "",
    }))
    .filter((row) => Boolean(row.email) && isDue(row.cadence, row.last_sent_at, now));

  const callbackUrl = `${requestOrigin(request)}/api/cron/digests/callback`;

  // Trigger every due issue concurrently. Per issue we insert a `pending`
  // digest_runs row (so a request is recorded even if n8n never calls back),
  // then fire the research webhook WITHOUT awaiting it. n8n calls back to
  // /api/cron/digests/callback with the report + this run's id; that route
  // stores it, emails it, and stamps last_sent_at. We do NOT stamp
  // last_sent_at here — an issue is only "sent" once the email goes out, so a
  // failed trigger or a workflow that never finishes retries on the next run.
  //
  // Each issue is isolated: a failed trigger marks that row errored and is
  // counted as failed, but can't stall or fail the rest.
  const outcomes = await Promise.allSettled(
    due.map(async (issue) => {
      // `title` holds the tracked topics, `prompt` the user's instructions —
      // wrap both into the past-24h research prompt the n8n workflow expects.
      // The owner's saved org context (organization + custom prompt) is
      // appended to the instructions so the digest is tailored to their org.
      const orgContext = orgContextByUser.get(issue.user_id);
      const researchPrompt = buildDigestPrompt({
        topics: issue.title,
        instructions: orgContext
          ? `${issue.prompt}\n\n${orgContext}`
          : issue.prompt,
        now: new Date(now),
      });

      // Insert the pending row first so the callback has an id to target and we
      // have a durable record of the request.
      const { data: run, error: insertErr } = await supabase
        .from("digest_runs")
        .insert({
          issue_id: issue.id,
          user_id: issue.user_id,
          status: "pending",
        })
        .select("id")
        .single();
      if (insertErr || !run) throw insertErr ?? new Error("Could not create digest run.");

      try {
        await fireDigestResearch({
          prompt: researchPrompt,
          digestRunId: run.id,
          callbackUrl,
        });
      } catch (err) {
        // Couldn't reach n8n — mark the row errored so it isn't left dangling as
        // pending forever, then rethrow so it's counted as failed.
        await supabase
          .from("digest_runs")
          .update({
            status: "error",
            error: err instanceof Error ? err.message : "Could not reach research service.",
          })
          .eq("id", run.id);
        throw err;
      }
    }),
  );

  let triggered = 0;
  let failed = 0;
  const errors: CronItemError[] = [];
  outcomes.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      triggered++;
    } else {
      failed++;
      const reason =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      console.error(`Digest trigger failed for issue ${due[i].id}:`, outcome.reason);
      errors.push({ issueId: due[i].id, title: due[i].title, error: reason });
    }
  });

  // Durable record of this run. Note `sent` here counts issues *triggered*, not
  // emails delivered — the actual send happens later in the callback (which logs
  // its own outcome). This row captures how many digests we kicked off.
  await logCronRun({
    job: JOB,
    due: due.length,
    sent: triggered,
    failed,
    errors,
    durationMs: Date.now() - startedAt,
  });

  // Surface per-issue trigger failures inline so a manual trigger shows the cause.
  return NextResponse.json({ ok: true, due: due.length, triggered, failed, errors });
}
