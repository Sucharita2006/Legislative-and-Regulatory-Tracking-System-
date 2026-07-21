# Open Issues & Follow-ups

Tracking outstanding setup steps, constraints, and decisions for the Key Issue
Tracker digest feature. See `docs/digests.md` for the full architecture.

## Manual setup required (before digests work in production)

- [ ] **Run the updated SQL** in Supabase (SQL Editor → paste `supabase/schema.sql` → Run).
      Adds the `tracked_issues` and `digest_runs` tables. Idempotent — safe to re-run the whole file.
- [ ] **Set environment variables** in the Vercel project (and locally in `.env`):
  - [ ] `CRON_SECRET` — any long random string; Vercel Cron sends it as the `Authorization: Bearer` header.
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Project Settings → API. **Server-only; never expose to the browser.**
  - [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — SMTP credentials for sending digest emails.
- [ ] **Verify the SMTP sending domain** so digest emails don't land in spam (SPF/DKIM).

## Known constraints

- **Vercel function timeout.** The cron route sets `maxDuration = 300`, but the
  **Hobby plan caps functions at 60s** and allows **daily crons only**.
  Researching several issues in one invocation can exceed 60s. Options:
  upgrade to **Pro**, or split the work (one cron per cadence, fewer issues per
  run, or fan out per-issue).
- **Single-run serial loop.** Issues are researched one after another inside a
  single invocation. This compounds the timeout risk above. A queue / per-issue
  invocation would scale better but isn't built yet.
- **Cron timing is fixed UTC.** Currently `0 7 * * *` (07:00 UTC daily). Users
  can't choose a send time or timezone — cadence is daily/weekly only.

## Behavior notes (by design, but worth knowing)

- **Daily cron, per-row due check.** The cron fires daily; each issue's actual
  due time is computed from `cadence` + `last_sent_at` with a 12h grace margin.
- **Failure isolation.** If research/storage/email fails for one issue, it's
  logged, `last_sent_at` is left untouched, and the loop continues — so it
  retries next run rather than being skipped.
- **5 issues per user** is enforced by a DB trigger, not just the UI.

## Open questions / not yet built

- [ ] **"Past digests" view** — a UI in the Digests tab to read `digest_runs`
      history per issue (the table + RLS read policy already exist).
- [ ] **Email template polish** — current email is minimal inline-styled HTML
      from `micromark`. May want branded styling / a shared template.
- [ ] **Unsubscribe / pause link** in the email itself (users can currently only
      pause via the Digests tab).
- [ ] **Response-format assumption.** The digest research collector assumes the
      `general-research` webhook streams NDJSON (same shape as the live tool).
      If it ever returns plain JSON instead, `src/lib/research.ts` needs a
      fallback branch.
- [ ] **Stale links from the old `/research` route** — renamed to
      `/key-issue-tracker`; any external bookmarks to `/tools/research` now 404.
