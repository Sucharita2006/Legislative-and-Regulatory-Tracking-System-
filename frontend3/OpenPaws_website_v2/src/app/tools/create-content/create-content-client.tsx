"use client";

import { useState } from "react";
import { Heading } from "@/components/ui";

type Variant = { text: string; score: number | null };

/**
 * Content-generation tool. Posts free-form instructions to /api/create-content
 * (which attaches the signed-in user server-side) and renders the returned
 * variants as copyable cards.
 *
 * Unlike the research tools, this is a single request/response that returns
 * structured variants rather than streamed markdown, so it keeps its own local
 * state instead of using the shared ToolTasks provider.
 */
export function CreateContentClient() {
  const [instructions, setInstructions] = useState("");
  const [running, setRunning] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const text = instructions.trim();
    if (!text || running) return;

    setRunning(true);
    setError(null);
    setVariants([]);

    try {
      const res = await fetch("/api/create-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status}).`);
        return;
      }
      const list: Variant[] = Array.isArray(data?.variants) ? data.variants : [];
      if (list.length === 0) {
        setError("The request finished but returned no content.");
        return;
      }
      setVariants(list);
    } catch {
      setError("Connection lost. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Create <span className="italic">content</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-white/60">
        Describe the content you need — a social post, an email, a campaign
        message — and the assistant drafts several on-brand variants for you to
        choose from. Each is scored for relevance; pick the one that fits best.
      </p>

      <form onSubmit={run} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="instructions"
            className="mb-2 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40"
          >
            Instructions
          </label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void run(e);
              }
            }}
            rows={5}
            placeholder="e.g. Write a short social post encouraging people to adopt rescue dogs."
            disabled={running}
            className="min-h-[8rem] w-full resize-y rounded-xl border border-white/15 bg-black px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={running || !instructions.trim()}
            className="rounded-full bg-teal px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a] disabled:pointer-events-none disabled:opacity-40"
          >
            {running ? "Generating…" : "Generate"}
          </button>
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/30">
            Ctrl/⌘ + Enter
          </span>
        </div>
      </form>

      {error && (
        <p className="mt-6 font-mono text-xs text-coral" role="alert">
          {error}
        </p>
      )}

      {running && variants.length === 0 && (
        <p className="mt-8 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-teal">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
          Drafting variants… this can take a minute.
        </p>
      )}

      {variants.length > 0 && (
        <div className="mt-8 space-y-4">
          {variants.map((variant, i) => (
            <VariantCard key={i} index={i + 1} variant={variant} />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantCard({ index, variant }: { index: number; variant: Variant }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(variant.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — leave the button as-is.
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40">
          Variant {index}
          {variant.score !== null && (
            <span className="ml-3 rounded-full border border-white/10 px-2 py-0.5 text-white/50">
              score {variant.score.toFixed(2)}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-white/20 px-4 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-teal hover:text-teal"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-white/80">{variant.text}</p>
    </div>
  );
}
