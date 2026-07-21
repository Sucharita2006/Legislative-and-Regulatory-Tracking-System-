import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Durable logging for scheduled jobs. Vercel's function logs are short-lived and
 * hard to query after the fact, so each cron invocation also records a row in
 * `public.cron_runs` (see supabase/schema.sql). Writes use the service role.
 *
 * Logging must never break the job it's observing: if the insert fails (e.g. the
 * table hasn't been created yet), we swallow the error and carry on.
 */

export type CronItemError = {
  issueId?: string;
  title?: string;
  error: string;
};

export type CronRunLog = {
  job: string;
  due: number;
  sent: number;
  failed: number;
  errors?: CronItemError[];
  /** A run-level message — e.g. a fatal error that aborted the whole job. */
  detail?: string;
  durationMs?: number;
};

/** Derive the run status from its counts. */
function statusFor(log: CronRunLog): "ok" | "partial" | "error" {
  if (log.failed > 0 && log.sent === 0) return "error";
  if (log.failed > 0) return "partial";
  return "ok";
}

/** Persist one cron run. Best-effort: never throws. */
export async function logCronRun(log: CronRunLog): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("cron_runs").insert({
      job: log.job,
      status: statusFor(log),
      due: log.due,
      sent: log.sent,
      failed: log.failed,
      errors: log.errors ?? [],
      detail: log.detail ?? null,
      duration_ms: log.durationMs ?? null,
    });
    if (error) {
      console.error("[cron-log] failed to persist cron_runs row:", error.message);
    }
  } catch (err) {
    console.error(
      "[cron-log] unexpected error persisting cron run:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
