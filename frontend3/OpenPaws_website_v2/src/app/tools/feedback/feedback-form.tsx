"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { submitFeedback, type FeedbackState } from "./actions";

type Kind = "bug" | "feature";

const COPY: Record<Kind, { heading: string; placeholder: string; cta: string }> = {
  bug: {
    heading: "Found a bug or something to improve? Tell us what went wrong.",
    placeholder:
      "What happened, what you expected, and where (which tool/page)? Steps to reproduce help a lot.",
    cta: "Send bug report",
  },
  feature: {
    heading: "Have an idea? Tell us what you'd like Open Paws to do.",
    placeholder:
      "Describe the feature you'd like, and what problem it would solve for your advocacy work.",
    cta: "Send feature request",
  },
};

export function FeedbackForm() {
  const [kind, setKind] = useState<Kind>("bug");
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(
    submitFeedback,
    null,
  );

  const sent = state && "message" in state;

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.02] p-8">
      <div className="mb-6 flex gap-1 rounded-full border border-white/10 p-1">
        <KindTab active={kind === "bug"} onClick={() => setKind("bug")}>
          Report a bug
        </KindTab>
        <KindTab active={kind === "feature"} onClick={() => setKind("feature")}>
          Request a feature
        </KindTab>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-white/70">
        {COPY[kind].heading}
      </p>

      <form action={formAction} className="space-y-4">
        {/* Carries the selected type to the server action. */}
        <input type="hidden" name="kind" value={kind} />

        <label className="block">
          <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.15em] text-white/60">
            Your message
          </span>
          <textarea
            name="message"
            required
            rows={7}
            maxLength={5000}
            placeholder={COPY[kind].placeholder}
            className="min-h-[10rem] w-full resize-y rounded-lg border border-white/15 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
          />
        </label>

        {state && "error" in state && (
          <p className="font-mono text-xs text-coral" role="alert">
            {state.error}
          </p>
        )}
        {sent && (
          <p className="font-mono text-xs text-teal" role="status">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending…" : COPY[kind].cta}
        </Button>
      </form>
    </div>
  );
}

function KindTab({
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
