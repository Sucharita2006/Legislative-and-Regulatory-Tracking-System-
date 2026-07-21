"use server";

import { createClient } from "@/lib/supabase/server";
import { isApproved } from "@/lib/auth";
import { isMailerConfigured, sendMail } from "@/lib/mailer";

/** Where feedback / feature requests are emailed. Override with FEEDBACK_TO. */
const FEEDBACK_TO = process.env.FEEDBACK_TO ?? "christoph@openpaws.ai";

export type FeedbackState = { error: string } | { message: string } | null;

const KINDS = ["bug", "feature"] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABEL: Record<Kind, string> = {
  bug: "Bug report",
  feature: "Feature request",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sends a feedback / feature-request email to FEEDBACK_TO. Logged-in,
 * approved users only — the caller's email is captured automatically, so we
 * never trust a client-supplied address. Stores nothing; this is fire-and-email.
 */
export async function submitFeedback(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  // Only authenticated, approved users can submit (mirrors the tools gate).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Please sign in to send feedback." };
  }
  if (!(await isApproved())) {
    return { error: "Your account is awaiting approval." };
  }

  const kindRaw = String(formData.get("kind") ?? "");
  const kind: Kind = (KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as Kind)
    : "bug";
  const message = String(formData.get("message") ?? "").trim();

  if (!message) {
    return { error: "Please describe your feedback before sending." };
  }
  if (message.length > 5000) {
    return { error: "That's a bit long — please keep it under 5000 characters." };
  }

  if (!isMailerConfigured()) {
    return {
      error: "Feedback isn't configured right now. Please email us directly.",
    };
  }

  const from = user.email ?? "(unknown email)";
  const subject = `[${KIND_LABEL[kind]}] from ${from}`;
  const text =
    `Type: ${KIND_LABEL[kind]}\n` +
    `From: ${from} (user id: ${user.id})\n\n` +
    `${message}\n`;
  const html =
    `<p><strong>Type:</strong> ${escapeHtml(KIND_LABEL[kind])}</p>` +
    `<p><strong>From:</strong> ${escapeHtml(from)} ` +
    `<span style="color:#888">(user id: ${escapeHtml(user.id)})</span></p>` +
    `<hr /><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;

  try {
    await sendMail({ to: FEEDBACK_TO, subject, html, text });
  } catch (err) {
    console.error("Feedback email failed:", err);
    return { error: "Couldn't send your feedback. Please try again." };
  }

  return {
    message:
      kind === "bug"
        ? "Thanks — your bug report is on its way. We appreciate it!"
        : "Thanks — your feature request has been sent. We appreciate it!",
  };
}
