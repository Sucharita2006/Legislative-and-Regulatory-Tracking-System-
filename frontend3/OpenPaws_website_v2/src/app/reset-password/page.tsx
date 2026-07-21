import type { Metadata } from "next";
import { Container, Heading, SectionLabel } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";
import { RecoveryGate } from "./recovery-gate";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const supabase = await createClient();

  let {
    data: { user },
  } = await supabase.auth.getUser();

  // PKCE flow: the recovery link can land here directly with `?code=` (e.g. when
  // Supabase's email template redirects straight to /reset-password). The code
  // MUST be exchanged server-side, because the PKCE code-verifier was stored in
  // a server-only cookie when the reset email was requested. Do it here so the
  // page works whether or not the link routed through /auth/callback first.
  if (!user) {
    const { code } = await searchParams;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        ({
          data: { user },
        } = await supabase.auth.getUser());
      }
    }
  }

  return (
    <Container className="py-24">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8">
        <SectionLabel>Reset password</SectionLabel>
        <Heading className="mt-3 text-2xl text-white">
          Choose a new password
        </Heading>

        {user ? (
          <>
            <p className="mt-2 break-all font-mono text-sm text-white/60">
              {user.email}
            </p>
            <ResetForm />
          </>
        ) : (
          // No server session and no usable code. This is the implicit recovery
          // flow, where Supabase returns the tokens in the URL hash fragment
          // (#access_token=…) that the server can't read. RecoveryGate runs in
          // the browser, establishes the session from the hash, then reveals the
          // form. If there's no recovery token either, it shows an expired-link
          // message.
          <RecoveryGate />
        )}
      </div>
    </Container>
  );
}
