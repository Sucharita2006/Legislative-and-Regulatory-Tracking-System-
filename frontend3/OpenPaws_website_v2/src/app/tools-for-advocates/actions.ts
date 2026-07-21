"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isApproved } from "@/lib/auth";
import { isMailerConfigured, sendMail } from "@/lib/mailer";

export type AuthState =
  | { error?: string; message?: string; signupComplete?: boolean }
  | null;

/** Who gets a heads-up when someone new signs up. Override with SIGNUP_NOTIFY_TO. */
const SIGNUP_NOTIFY_TO =
  process.env.SIGNUP_NOTIFY_TO ??
  "nicole@openpaws.ai, christoph@openpaws.ai";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Where to send a freshly authenticated user: straight to their tools if
 * approved, otherwise back to /tools-for-advocates (which shows the
 * "awaiting approval" notice).
 */
async function postAuthDestination(): Promise<string> {
  return (await isApproved()) ? "/tools" : "/tools-for-advocates";
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

/**
 * Best-effort origin of the current request (e.g. https://project-ai00b.vercel.app),
 * used to build absolute redirect URLs for auth emails so they point back at
 * whatever host the user is actually on — localhost in dev, Vercel in prod.
 */
async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/tools-for-advocates");
  redirect(await postAuthDestination());
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Application answers — they inform the manual approval, so all three are
  // required. The handle_new_user trigger copies them from the auth metadata
  // into the profile row, where the admin dashboard reads them.
  const orgDescription = String(formData.get("orgDescription") ?? "").trim();
  const orgRole = String(formData.get("orgRole") ?? "").trim();
  const accessReason = String(formData.get("accessReason") ?? "").trim();
  if (!orgDescription || !orgRole || !accessReason) {
    return {
      error:
        "Please tell us about your organization, your role, and why you'd like access.",
    };
  }
  if (
    orgDescription.length > 1000 ||
    orgRole.length > 200 ||
    accessReason.length > 1000
  ) {
    return { error: "One of your answers is too long — please shorten it." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        org_description: orgDescription,
        org_role: orgRole,
        access_reason: accessReason,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Supabase returns a user with an empty `identities` array when the email is
  // already registered (it won't reveal this outright, to avoid leaking which
  // emails exist). Treat that as "already registered" rather than a new signup.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "This email is already registered — sign in instead." };
  }

  // Heads-up to the team so the application gets reviewed promptly. Strictly
  // best-effort: a mail failure must never break the signup itself.
  if (data.user && !isMailerConfigured()) {
    console.warn(
      "Signup notification skipped: SMTP env vars (SMTP_HOST/USER/PASS/FROM) are not set.",
    );
  }
  if (data.user && isMailerConfigured()) {
    const adminUrl = `${await requestOrigin()}/tools/admin`;
    const text =
      `A new user signed up and is awaiting approval.\n\n` +
      `Email: ${email}\n` +
      `Role: ${orgRole}\n\n` +
      `About their organization:\n${orgDescription}\n\n` +
      `Why they'd like access:\n${accessReason}\n\n` +
      `Approve them here: ${adminUrl}\n`;
    const html =
      `<p>A new user signed up and is awaiting approval.</p>` +
      `<p><strong>Email:</strong> ${escapeHtml(email)}<br />` +
      `<strong>Role:</strong> ${escapeHtml(orgRole)}</p>` +
      `<p><strong>About their organization:</strong></p>` +
      `<p style="white-space:pre-wrap">${escapeHtml(orgDescription)}</p>` +
      `<p><strong>Why they'd like access:</strong></p>` +
      `<p style="white-space:pre-wrap">${escapeHtml(accessReason)}</p>` +
      `<p><a href="${adminUrl}">Review and approve on the admin dashboard</a></p>`;
    try {
      await sendMail({
        to: SIGNUP_NOTIFY_TO,
        subject: `[Open Paws] New signup awaiting approval: ${email}`,
        text,
        html,
      });
    } catch (err) {
      console.error("Signup notification email failed:", err);
    }
  }

  // If email confirmation is enabled, a genuine new signup has no session yet.
  // signupComplete swaps the form for a confirmation card in the UI.
  if (data.user && !data.session) {
    return {
      signupComplete: true,
      message:
        "Your application has been sent to our admins for approval. " +
        "In the meantime, check your inbox for a confirmation email to verify your address. " +
        "You'll be able to use the tools as soon as an admin approves your account.",
    };
  }

  revalidatePath("/tools-for-advocates");
  redirect("/tools-for-advocates");
}

/**
 * Sends a password-reset email. The link routes through /auth/callback, which
 * runs server-side and exchanges the PKCE `?code=` for a session — this MUST
 * happen on the server because the PKCE code-verifier was stored in a cookie by
 * this very call and is only readable server-side. The callback then redirects
 * to /reset-password with the session established.
 *
 * Always reports success, even for unknown emails, so we don't reveal which
 * addresses are registered.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Please enter your email." };
  }

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    message:
      "If that email is registered, a reset link is on its way. " +
      "Open it in this same browser — the link won't work elsewhere.",
  };
}

/**
 * Sets a new password for the user. Requires an active session — established by
 * the recovery link landing on /reset-password via /auth/callback.
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/tools-for-advocates");
  redirect("/tools-for-advocates");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/tools-for-advocates");
  redirect("/tools-for-advocates");
}
