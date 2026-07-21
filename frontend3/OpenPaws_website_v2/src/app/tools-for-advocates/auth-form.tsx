"use client";

import { useActionState, useState } from "react";
import { Button, Heading } from "@/components/ui";
import { login, signup, requestPasswordReset, type AuthState } from "./actions";

type Mode = "login" | "signup" | "reset";

const actions = {
  login,
  signup,
  reset: requestPasswordReset,
} as const;

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8">
      {mode !== "reset" && (
        <div className="mb-6 flex gap-1 rounded-full border border-white/10 p-1">
          <ModeTab active={mode === "login"} onClick={() => setMode("login")}>
            Sign in
          </ModeTab>
          <ModeTab active={mode === "signup"} onClick={() => setMode("signup")}>
            Create account
          </ModeTab>
        </div>
      )}

      {mode === "reset" && (
        <p className="mb-6 text-sm leading-relaxed text-white/70">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      )}

      {/* key={mode} remounts the form on every mode switch: useActionState
          otherwise keeps the previous mode's action and error state, leaving
          e.g. the signup action wired to the Sign in button until a page
          refresh. */}
      <AuthFormFields key={mode} mode={mode} onModeChange={setMode} />

      <p className="mt-5 text-center text-xs text-white/40">
        {mode === "login" ? (
          "New here? Switch to Create account above."
        ) : mode === "reset" ? (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="underline-offset-4 hover:text-white hover:underline"
          >
            Back to sign in
          </button>
        ) : (
          "Already have an account? Switch to Sign in above."
        )}
      </p>
    </div>
  );
}

function AuthFormFields({
  mode,
  onModeChange,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    actions[mode],
    null,
  );

  // Successful signup: replace the form with a confirmation card so the
  // applicant clearly sees their request went to an admin for approval.
  if (state?.signupComplete) {
    return <SignupReceived message={state.message} onBackToLogin={() => onModeChange("login")} />;
  }

  return (
    <form action={formAction} className="space-y-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.org"
        />
        {mode !== "reset" && (
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
          />
        )}

        {/* Application answers — shown to admins to decide on approval. */}
        {mode === "signup" && (
          <>
            <TextareaField
              label="About your organization"
              name="orgDescription"
              rows={3}
              maxLength={1000}
              placeholder="Which organization do you advocate with, and what does it work on?"
            />
            <Field
              label="Your role"
              name="orgRole"
              type="text"
              autoComplete="organization-title"
              placeholder="e.g. Campaign manager, volunteer, researcher"
              maxLength={200}
            />
            <TextareaField
              label="Why would you like access?"
              name="accessReason"
              rows={3}
              maxLength={1000}
              placeholder="How would the Open Paws tools help your advocacy work?"
            />
          </>
        )}

        {mode === "login" && (
          <button
            type="button"
            onClick={() => onModeChange("reset")}
            className="font-mono text-xs text-white/50 underline-offset-4 hover:text-white hover:underline"
          >
            Forgot password?
          </button>
        )}

        {state?.error && (
          <p className="font-mono text-xs text-coral" role="alert">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p className="font-mono text-xs text-teal" role="status">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? "Working…"
            : mode === "login"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
        </Button>
      </form>
  );
}

/**
 * Shown in place of the signup form once the application is submitted, so the
 * applicant knows their request is with an admin and what happens next.
 */
function SignupReceived({
  message,
  onBackToLogin,
}: {
  message?: string;
  onBackToLogin: () => void;
}) {
  return (
    <div role="status" className="space-y-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-teal/40 bg-teal/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-teal"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <Heading as="h2" className="text-2xl text-white">
        Application received
      </Heading>
      <p className="text-sm leading-relaxed text-white/70">
        {message ??
          "Your application has been sent to our admins for approval. You'll be able to use the tools as soon as an admin approves your account."}
      </p>
      <Button type="button" variant="outline" className="w-full" onClick={onBackToLogin}>
        Back to sign in
      </Button>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
        active ? "bg-teal text-on-teal" : "text-white/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  placeholder,
  maxLength,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.15em] text-white/60">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-lg border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
      />
    </label>
  );
}

function TextareaField({
  label,
  name,
  rows,
  maxLength,
  placeholder,
}: {
  label: string;
  name: string;
  rows: number;
  maxLength: number;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.15em] text-white/60">
        {label}
      </span>
      <textarea
        name={name}
        required
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
      />
    </label>
  );
}
