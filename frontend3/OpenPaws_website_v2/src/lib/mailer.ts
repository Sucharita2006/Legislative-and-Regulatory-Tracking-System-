import "server-only";
import nodemailer from "nodemailer";

/**
 * Shared SMTP transport, built from env credentials. Used by server jobs (the
 * digest cron) to send email. Requires the Node.js runtime — not edge.
 *
 * Env:
 *   SMTP_HOST, SMTP_PORT (465 = implicit TLS, else STARTTLS),
 *   SMTP_USER, SMTP_PASS, SMTP_FROM (e.g. "Open Paws <digests@openpaws.ai>")
 */
let cached: nodemailer.Transporter | null = null;

export function isMailerConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
  );
}

function getTransport(): nodemailer.Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // implicit TLS on 465; STARTTLS otherwise
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

/** Send one HTML email (with a plain-text fallback). Throws on failure. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await getTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
