import { NextResponse, type NextRequest } from "next/server";
import { micromark } from "micromark";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMailerConfigured, sendMail } from "@/lib/mailer";
import { logCronRun } from "@/lib/cron-log";

// nodemailer needs the Node.js runtime (not edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sending the email + a couple of DB writes is quick, but keep headroom.
export const maxDuration = 60;

/**
 * Pull the report text out of whatever the general-research workflow posts back.
 * It may send the report as a string under `report`/`result`/`output`/`text`,
 * or as a nested object — probe the common shapes, else stringify.
 */
function extractReport(body: Record<string, unknown>): string {
  const raw = body.report ?? body.result ?? body.output ?? body.text ?? body.markdown;
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return "";
  return JSON.stringify(raw);
}

function digestEmail(title: string, markdown: string) {
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:640px">
    <h1 style="font-size:20px">${escapeHtml(title)}</h1>
    ${micromark(markdown)}
    <hr style="margin-top:32px;border:none;border-top:1px solid #eee" />
    <p style="font-size:12px;color:#888">You're receiving this because you track this issue in the Open Paws Key Issue Tracker.</p>
  </div>`;
  return { html, text: markdown };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Completion callback for a daily/weekly digest. The n8n research workflow POSTs
 * here when it finishes, with the digest run id and either a report (markdown)
 * or an error. The cron already inserted a `pending` digest_runs row and handed
 * n8n its id; here we:
 *   1. flip that row to `done` with the report as `content` (or `error`),
 *   2. email the rendered digest to the issue owner,
 *   3. stamp digest_runs.sent_at + tracked_issues.last_sent_at.
 *
 * Authorization is by capability: the `digestRunId` is a random UUID that only
 * ever travels cron → n8n → here (it's never exposed to a browser), so knowing
 * a valid, still-`pending` id is itself proof the caller is the workflow we
 * fired. There is no shared secret. The `pending` check below is both the authz
 * gate and the idempotency point: an unknown/settled id updates nothing.
 *
 * Only rows still `pending` are acted on, so a duplicate callback is a no-op —
 * we return 200 either way so n8n doesn't retry a settled run. last_sent_at is
 * stamped ONLY after a successful send, so a delivery failure leaves the issue
 * due and it retries on the next cron run.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const digestRunId = String(body?.digestRunId ?? body?.digest_run_id ?? "").trim();
  if (!digestRunId) {
    return NextResponse.json({ error: "Missing digestRunId." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load the pending run. RLS is bypassed by the service role. If it's already
  // terminal (duplicate callback) we short-circuit below.
  const { data: run, error: runErr } = await admin
    .from("digest_runs")
    .select("id, issue_id, user_id, status")
    .eq("id", digestRunId)
    .maybeSingle();
  if (runErr) {
    console.error("[digests/callback] failed to load digest run:", runErr.message);
    return NextResponse.json(
      { error: "Failed to load digest run.", detail: runErr.message },
      { status: 500 },
    );
  }
  if (!run) {
    // Unknown id — 200 so n8n doesn't retry forever.
    return NextResponse.json({ ok: true, updated: false });
  }
  if (run.status !== "pending") {
    // Already settled (duplicate callback) — no-op.
    return NextResponse.json({ ok: true, updated: false });
  }

  // An explicit error from the workflow wins.
  const workflowError =
    typeof body?.error === "string" && body.error.trim() ? body.error.trim() : null;
  if (workflowError) {
    await admin
      .from("digest_runs")
      .update({ status: "error", error: workflowError })
      .eq("id", digestRunId)
      .eq("status", "pending");
    await logCronRun({
      job: "digests-callback",
      due: 1,
      sent: 0,
      failed: 1,
      errors: [{ issueId: run.issue_id, error: workflowError }],
    });
    return NextResponse.json({ ok: true, updated: true });
  }

  const content = extractReport(body);
  if (!content) {
    await admin
      .from("digest_runs")
      .update({ status: "error", error: "Empty research result." })
      .eq("id", digestRunId)
      .eq("status", "pending");
    return NextResponse.json({ error: "Missing report or error." }, { status: 400 });
  }

  // Store the report and claim the row (pending → done). The `.eq('status',
  // 'pending')` guard makes this the idempotency point: a racing duplicate
  // callback updates zero rows and stops here.
  const { data: claimed, error: claimErr } = await admin
    .from("digest_runs")
    .update({ status: "done", content, error: null })
    .eq("id", digestRunId)
    .eq("status", "pending")
    .select("id");
  if (claimErr) {
    console.error("[digests/callback] failed to store report:", claimErr.message);
    return NextResponse.json(
      { error: "Failed to store report.", detail: claimErr.message },
      { status: 500 },
    );
  }
  if (!claimed?.length) {
    // Lost the race to a duplicate callback — the other one owns the send.
    return NextResponse.json({ ok: true, updated: false });
  }

  // We can't email without SMTP config, but the report IS stored, so the user
  // can still read it in-app. Report the miss rather than 500.
  if (!isMailerConfigured()) {
    await logCronRun({
      job: "digests-callback",
      due: 1,
      sent: 0,
      failed: 1,
      detail: "Report stored but email is not configured (missing SMTP_* env vars).",
      errors: [{ issueId: run.issue_id, error: "Email not configured." }],
    });
    return NextResponse.json({ ok: true, updated: true, emailed: false });
  }

  // Resolve the issue title + owner email for the email.
  const [{ data: issue }, { data: profile }] = await Promise.all([
    admin.from("tracked_issues").select("title, cadence").eq("id", run.issue_id).maybeSingle(),
    admin.from("profiles").select("email").eq("id", run.user_id).maybeSingle(),
  ]);
  const title = issue?.title ?? "Your tracked issue";
  const cadence = issue?.cadence ?? "weekly";
  const email = profile?.email ?? "";

  if (!email) {
    await logCronRun({
      job: "digests-callback",
      due: 1,
      sent: 0,
      failed: 1,
      detail: "Report stored but the issue owner has no email on file.",
      errors: [{ issueId: run.issue_id, title, error: "No owner email." }],
    });
    return NextResponse.json({ ok: true, updated: true, emailed: false });
  }

  try {
    const { html, text } = digestEmail(title, content);
    await sendMail({
      to: email,
      subject: `Your ${cadence} digest: ${title}`,
      html,
      text,
    });
  } catch (err) {
    // The report is stored (status=done) but the email failed. Leave
    // last_sent_at untouched so the issue is still due and retries next run
    // (which will produce a fresh digest_runs row). Record the failure.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[digests/callback] email send failed:", detail);
    await logCronRun({
      job: "digests-callback",
      due: 1,
      sent: 0,
      failed: 1,
      errors: [{ issueId: run.issue_id, title, error: detail }],
    });
    return NextResponse.json({ ok: true, updated: true, emailed: false });
  }

  // Delivered — stamp both timestamps.
  const sentAt = new Date().toISOString();
  await admin.from("digest_runs").update({ sent_at: sentAt }).eq("id", digestRunId);
  await admin.from("tracked_issues").update({ last_sent_at: sentAt }).eq("id", run.issue_id);

  await logCronRun({
    job: "digests-callback",
    due: 1,
    sent: 1,
    failed: 0,
  });

  return NextResponse.json({ ok: true, updated: true, emailed: true });
}
