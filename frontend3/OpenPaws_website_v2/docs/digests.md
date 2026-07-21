# Issue digests

The Key Issue Tracker emails users a digest of each issue they track, on a
daily or weekly cadence. Vercel **orchestrates** the loop but no longer blocks
on research: the cron triggers each due issue's research and returns in seconds,
and n8n calls back with the finished report — which is what stores and emails
it. This mirrors the async pattern the interactive tools use (`tool_runs` +
`/api/tool-runs/callback`).

```
Vercel Cron (daily 07:00 UTC)
  └─ GET /api/cron/digests   (Authorization: Bearer $CRON_SECRET)
       ├─ read due tracked_issues (+ owner email) via Supabase service role
       └─ for each due issue (does NOT await n8n):
            ├─ insert digest_runs (status='pending')
            └─ POST $N8N_GENERAL_RESEARCH_WEBHOOK_URL
                 { prompt, digestRunId, callbackUrl }   → fire, don't wait
       └─ return { ok, due, triggered, failed }         [seconds]

... minutes later, when n8n finishes ...

n8n → POST /api/cron/digests/callback
        { digestRunId, report }              (no secret — see "Authorization")
       ├─ update digest_runs (content, status='done')   (idempotent on 'pending')
       ├─ SMTP email the rendered digest
       └─ set digest_runs.sent_at + tracked_issues.last_sent_at
```

## Authorization

The digest callback uses **no shared secret**. It authorizes by capability: the
`digestRunId` is a `gen_random_uuid()` the cron generates and hands to n8n, and
it *only* ever travels cron → n8n → callback — it is never sent to a browser (
unlike the interactive tools' `runId`, which the browser polls). So presenting a
valid, still-`pending` id is itself proof the caller is the workflow we fired.
The `pending` check is both the authz gate and the idempotency point: an
unknown or already-settled id updates zero rows and is a 200 no-op. The
interactive tools' `/api/tool-runs/callback` is unchanged and still uses
`TOOL_RUNS_CALLBACK_SECRET`.

**Why async?** Research runs 6+ minutes — longer than the cron function should
stay alive, and a batch of issues would blow past `maxDuration` if awaited
sequentially. Firing and letting n8n call back means the cron returns fast and
the report is durably stored (in `digest_runs`) the moment n8n finishes, even
though no request is still open.

## "Due" logic

The cron fires **daily**; the route decides per row what's actually due from
`cadence` and `last_sent_at` (see `DUE_AFTER_MS` in the route). An issue is due
when it's `active`, the owner has an email, and it was either never sent or last
sent at least one cadence-interval ago (with a 12h grace margin so a row isn't
skipped when the cron fires a little early). Daily issues retry next day,
weekly issues next week. There's one schedule, not two.

## Failure handling

Each issue is triggered independently. Two stages can fail:

- **Trigger (cron):** if n8n is unreachable for one issue, its `digest_runs` row
  is marked `status='error'`, it's counted in `failed`, and its `last_sent_at`
  is left untouched — so it retries next run. Other issues are unaffected.
- **Completion (callback):** the report is stored (`status='done'`) *before* the
  email is attempted, so it's always readable in-app. `last_sent_at` is stamped
  **only after a successful send**, so a delivery failure (or missing SMTP /
  owner email) leaves the issue due and it retries next run with a fresh row.

The callback only acts on rows still `pending`, so a duplicate n8n callback is a
no-op (it returns 200 so n8n stops retrying). A workflow that never calls back
leaves a `pending` row as a durable record that the digest was requested.

The cron returns `{ ok, due, triggered, failed }` (`triggered` = issues kicked
off, not emails delivered — the send happens later in the callback, which logs
its own `digests-callback` cron_runs rows).

## Environment

Set these in the Vercel project (and locally in `.env`):

| Var                         | Purpose                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `CRON_SECRET`               | Vercel Cron sends it as `Authorization: Bearer <value>`. Any long random string. Also lets an external trigger (GitHub Actions) authenticate. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (Project Settings → API). Lets the cron read all users' rows and write digests, bypassing RLS. **Server-only — never expose to the browser.** |
| `N8N_GENERAL_RESEARCH_WEBHOOK_URL` | The research backend (already used by the live tool). Must call `/api/cron/digests/callback` when done. |
| `SMTP_HOST` / `SMTP_PORT`   | SMTP server. Port 465 = implicit TLS, otherwise STARTTLS.     |
| `SMTP_USER` / `SMTP_PASS`   | SMTP auth.                                                    |
| `SMTP_FROM`                 | From header, e.g. `Open Paws <digests@openpaws.ai>`.          |

## What n8n must send back

The digest research workflow's final HTTP-Request node must POST to
`{origin}/api/cron/digests/callback` (the cron passes the exact `callbackUrl` in
its request body) with:

```json
{
  "digestRunId": "<the digestRunId the cron sent>",
  "report": "<the finished markdown report>"
}
```

No secret is sent (see [Authorization](#authorization)). On failure, send
`{ "digestRunId": "...", "error": "..." }` so the row is marked errored (and
retried next run) rather than left pending. The report field may also be named
`result`, `output`, `text`, or `markdown`.

## Schedule

Defined in `vercel.json` (`crons` → `/api/cron/digests`, `0 7 * * *` = daily
07:00 UTC). Vercel automatically attaches the `Authorization: Bearer
$CRON_SECRET` header to scheduled invocations.

> **Vercel function limits.** Because the cron now only *triggers* research and
> returns, it no longer needs a long `maxDuration` — it's set to 60s, well
> within even the Hobby cap, no matter how many issues are due. The callback
> route is likewise short (one email + a couple of DB writes). The old 800s
> ceiling was only needed while the cron blocked on n8n. Note Hobby still allows
> only daily crons.

## Triggering manually / from GitHub Actions

The route is a plain authenticated GET, so anything that can send the bearer
header works:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-deployment>/api/cron/digests
```

A GitHub Actions `schedule:` workflow doing the same curl is a drop-in
alternative to Vercel Cron (e.g. if you want sub-daily on the Hobby plan).

## Database

`tracked_issues` and `digest_runs` live in `supabase/schema.sql` (idempotent —
re-run the whole file in the SQL Editor to apply). `digest_runs` keeps the full
history per issue; users can read their own via RLS, only the service role
writes.
```
