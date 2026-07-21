"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessProfile } from "@/lib/auth";
import { isMailerConfigured, sendMail } from "@/lib/mailer";
import { tools } from "@/lib/tools";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/**
 * Every action re-verifies the caller server-side (the UI hiding buttons is
 * not a security boundary) and then mutates via the service-role client,
 * since profiles has no user-facing write policy.
 */
async function requireAdmin() {
  const profile = await getAccessProfile();
  if (!profile?.isAdmin) {
    throw new Error("Not authorized.");
  }
  return profile;
}

function failed(err: unknown): AdminActionResult {
  return {
    ok: false,
    error: err instanceof Error ? err.message : "Something went wrong.",
  };
}

/**
 * Approve (or un-approve) a user's account. On a genuine un-approved → approved
 * flip the user is emailed that their access is ready (best-effort — a mail
 * failure never rolls back the approval). Approvals made directly in the
 * Supabase dashboard bypass this and send nothing.
 */
export async function setUserApproved(
  userId: string,
  approved: boolean,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    // Read the row first so a re-toggle (or an already-approved user) doesn't
    // trigger a duplicate "you're approved" email.
    const { data: before, error: readErr } = await admin
      .from("profiles")
      .select("email, approved")
      .eq("id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    const { error } = await admin
      .from("profiles")
      .update({ approved })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    const newlyApproved = approved && before?.approved !== true;
    if (newlyApproved && before?.email && isMailerConfigured()) {
      const toolsUrl = `${await requestOrigin()}/tools`;
      try {
        await sendMail({
          to: before.email,
          subject: "You're approved — your Open Paws tools are ready",
          text:
            `Good news — your Open Paws account has been approved!\n\n` +
            `You now have access to the AI tools for animal advocates: ` +
            `chat, research, and more.\n\n` +
            `Get started here: ${toolsUrl}\n\n` +
            `Questions or feedback? Just reply to this email.\n\n` +
            `— The Open Paws team`,
          html:
            `<p>Good news — your Open Paws account has been <strong>approved</strong>!</p>` +
            `<p>You now have access to the AI tools for animal advocates: ` +
            `chat, research, and more.</p>` +
            `<p><a href="${toolsUrl}">Open your tools</a></p>` +
            `<p>Questions or feedback? Just reply to this email.</p>` +
            `<p>— The Open Paws team</p>`,
        });
      } catch (err) {
        // The approval itself succeeded; log the mail failure and move on.
        console.error("Approval email failed:", err);
      }
    }

    revalidatePath("/tools/admin");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

/** Grant or revoke admin rights. Admins cannot demote themselves. */
export async function setUserAdmin(
  userId: string,
  makeAdmin: boolean,
): Promise<AdminActionResult> {
  try {
    const caller = await requireAdmin();
    if (!makeAdmin && caller.userId === userId) {
      throw new Error("You can't remove your own admin access.");
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ is_admin: makeAdmin })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/tools/admin");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

/** Enable or disable one tool for one user. */
export async function setUserToolAccess(
  userId: string,
  toolSlug: string,
  enabled: boolean,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    if (!tools.some((t) => t.slug === toolSlug)) {
      throw new Error(`Unknown tool: ${toolSlug}`);
    }

    const admin = createAdminClient();
    const { data: profile, error: readErr } = await admin
      .from("profiles")
      .select("disabled_tools")
      .eq("id", userId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const current = new Set<string>(
      Array.isArray(profile.disabled_tools) ? profile.disabled_tools : [],
    );
    if (enabled) current.delete(toolSlug);
    else current.add(toolSlug);

    const { error } = await admin
      .from("profiles")
      .update({ disabled_tools: Array.from(current) })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/tools/admin");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

/**
 * Permanently delete a user's account. Deleting the auth user is enough:
 * profiles, chat sessions, tool runs, tracked issues, and digests all
 * `references auth.users (id) on delete cascade` (see supabase/schema.sql).
 * Admins cannot delete themselves — demote/delete via another admin instead.
 */
export async function deleteUser(userId: string): Promise<AdminActionResult> {
  try {
    const caller = await requireAdmin();
    if (caller.userId === userId) {
      throw new Error("You can't delete your own account.");
    }
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    revalidatePath("/tools/admin");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

/** Best-effort origin of the current request, for links in reset emails. */
async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Emails a password-reset link to a user, sent by Supabase itself (the same
 * mailer that delivers signup-confirmation emails), so it needs no app-side
 * SMTP credentials.
 *
 * The sending client is deliberately implicit-flow, NOT the SSR (PKCE)
 * client: a PKCE reset link only works in the browser that requested it —
 * here that would be the admin's, not the recipient's. An implicit link
 * instead lands on /reset-password with the session tokens in the URL hash,
 * which RecoveryGate handles in whatever browser the user opens it.
 */
export async function sendPasswordReset(
  userId: string,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();

    const admin = createAdminClient();
    const { data: profile, error: readErr } = await admin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (!profile.email) throw new Error("This user has no email address.");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error("Supabase is not configured.");
    const sender = createSupabaseClient(url, anonKey, {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const origin = await requestOrigin();
    const { error } = await sender.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}
