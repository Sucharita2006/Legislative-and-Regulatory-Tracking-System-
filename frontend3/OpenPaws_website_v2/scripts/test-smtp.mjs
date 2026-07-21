/**
 * Manual SMTP smoke test. Verifies the connection/credentials, then optionally
 * sends a real test email.
 *
 * Reads the same env vars as src/lib/mailer.ts:
 *   SMTP_HOST, SMTP_PORT (465 = implicit TLS, else STARTTLS),
 *   SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Run (Node 20+ loads .env natively with --env-file):
 *   node --env-file=.env scripts/test-smtp.mjs                 # verify only
 *   node --env-file=.env scripts/test-smtp.mjs you@example.com # verify + send
 */
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

// Recipient is the first CLI arg; falls back to SMTP_FROM (send to yourself).
const to = process.argv[2] ?? SMTP_FROM;

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// Show what we're working with, but never print the password.
console.log("SMTP config:");
console.log(`  host: ${SMTP_HOST ?? "(missing)"}`);
console.log(`  port: ${SMTP_PORT ?? "(default 587)"}`);
console.log(`  user: ${SMTP_USER ?? "(missing)"}`);
console.log(`  pass: ${SMTP_PASS ? "(set, " + SMTP_PASS.length + " chars)" : "(missing)"}`);
console.log(`  from: ${SMTP_FROM ?? "(missing)"}`);
console.log("");

const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  fail(
    `Missing env var(s): ${missing.join(", ")}. ` +
      `Did you run with --env-file=.env, and is SMTP_PASS set?`,
  );
}

const port = Number(SMTP_PORT ?? 587);
const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465, // implicit TLS on 465; STARTTLS otherwise
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// Step 1: verify connection + login without sending anything.
console.log("Verifying SMTP connection and credentials…");
try {
  await transport.verify();
  console.log("✓ Connection and auth OK.");
} catch (err) {
  fail(`SMTP verify failed: ${err?.message ?? err}`);
}

// Step 2: send a real test email.
console.log(`\nSending test email to ${to}…`);
try {
  const info = await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Open Paws SMTP test",
    text: "If you can read this, SMTP sending works. 🐾",
    html: "<p>If you can read this, SMTP sending works. 🐾</p>",
  });
  console.log(`✓ Sent. messageId: ${info.messageId}`);
  if (info.accepted?.length) console.log(`  accepted: ${info.accepted.join(", ")}`);
  if (info.rejected?.length) console.log(`  rejected: ${info.rejected.join(", ")}`);
  console.log("\nCheck the inbox (and spam folder).\n");
} catch (err) {
  fail(`Send failed: ${err?.message ?? err}`);
}
