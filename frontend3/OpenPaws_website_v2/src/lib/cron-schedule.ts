// Mirrors the schedule in vercel.json's `crons` array — update here if that changes.
const DIGEST_CRON_HOUR_UTC = 7;
const DIGEST_CRON_MINUTE_UTC = 0;

export function getNextDigestCronRun(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(DIGEST_CRON_HOUR_UTC, DIGEST_CRON_MINUTE_UTC, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export function formatTimeUntil(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "due now";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `in ${minutes}m`;
  return `in ${hours}h ${minutes}m`;
}
