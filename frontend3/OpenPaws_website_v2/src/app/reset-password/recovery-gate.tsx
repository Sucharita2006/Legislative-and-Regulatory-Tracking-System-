"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ResetForm } from "./reset-form";

const EXPIRED_MESSAGE =
  "Your reset link has expired or already been used.";

type Status =
  | { kind: "loading" }
  | { kind: "ready"; email: string | null }
  | { kind: "error"; message: string };

type Recovery = { accessToken: string; refreshToken: string };

/**
 * Reads the recovery tokens (or an error) from the URL hash fragment once,
 * synchronously, before the effect runs. This handles the *implicit* flow only
 * — tokens in the hash (`#access_token=…&refresh_token=…`), which the server
 * can't read. The PKCE `?code=` flow is exchanged server-side in page.tsx, so
 * by the time this component renders, a code (if any) has already been handled.
 * Returns the initial status plus any tokens still to exchange for a session.
 */
function readHash(): { status: Status; recovery: Recovery | null } {
  if (typeof window === "undefined") {
    return { status: { kind: "loading" }, recovery: null };
  }

  const hash = new URLSearchParams(window.location.hash.slice(1));

  // Supabase reports expired/invalid links via error params in the hash.
  if (hash.get("error_description") || hash.get("error")) {
    return {
      status: { kind: "error", message: EXPIRED_MESSAGE },
      recovery: null,
    };
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    return {
      status: { kind: "loading" },
      recovery: { accessToken, refreshToken },
    };
  }

  // Nothing in the hash — stay in `loading` so the effect can check whether a
  // session already exists (e.g. the client auto-consumed the hash on load).
  return { status: { kind: "loading" }, recovery: null };
}

/**
 * Handles the implicit password-recovery flow, where Supabase returns the
 * session tokens in the URL hash fragment (e.g. `#access_token=…&type=recovery`).
 * The server can't read the hash, so we read it in the browser, establish the
 * session via the browser Supabase client (which persists the auth cookies),
 * then reveal the reset form.
 */
export function RecoveryGate() {
  const [initial] = useState(readHash);
  const [status, setStatus] = useState<Status>(initial.status);

  useEffect(() => {
    // The error case is already settled synchronously during render.
    if (initial.status.kind === "error") return;

    const supabase = createClient();
    const recovery = initial.recovery;

    // Establish the session from the hash tokens, then reveal the form.
    const resolve = async () => {
      if (!recovery) {
        // Maybe a session already exists (the client may have auto-consumed the
        // hash on load). Fall back to checking before declaring the link dead.
        const { data } = await supabase.auth.getUser();
        return data.user?.email ?? null;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: recovery.accessToken,
        refresh_token: recovery.refreshToken,
      });
      if (error) throw error;
      return data.user?.email ?? null;
    };

    resolve()
      .then((email) => {
        if (email === null && !recovery) {
          // No credentials and no existing session — the link is dead.
          setStatus({ kind: "error", message: EXPIRED_MESSAGE });
          return;
        }
        // Strip credentials from the URL so they aren't left in history.
        window.history.replaceState(null, "", window.location.pathname);
        setStatus({ kind: "ready", email });
      })
      .catch(() => {
        setStatus({ kind: "error", message: EXPIRED_MESSAGE });
      });
  }, [initial]);

  if (status.kind === "loading") {
    return (
      <p className="mt-6 font-mono text-sm text-white/60">
        Verifying your reset link…
      </p>
    );
  }

  if (status.kind === "error") {
    return (
      <p className="mt-6 font-mono text-sm text-coral" role="alert">
        {status.message} Request a new one from the sign-in page.
      </p>
    );
  }

  return (
    <>
      {status.email && (
        <p className="mt-2 break-all font-mono text-sm text-white/60">
          {status.email}
        </p>
      )}
      <ResetForm />
    </>
  );
}
