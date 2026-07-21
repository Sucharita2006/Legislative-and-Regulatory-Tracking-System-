"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { updatePassword, type AuthState } from "@/app/tools-for-advocates/actions";

export function ResetForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    null,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.15em] text-white/60">
          New password
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="w-full rounded-lg border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
        />
      </label>

      {state?.error && (
        <p className="font-mono text-xs text-coral" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Working…" : "Update password"}
      </Button>
    </form>
  );
}
