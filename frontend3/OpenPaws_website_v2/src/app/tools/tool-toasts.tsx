"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { tools } from "@/lib/tools";
import { useToolTasks } from "./tool-tasks";

type Toast = { slug: string; name: string; isError: boolean };

/**
 * Pops a notification when a tool's long-running n8n request finishes while
 * you're looking at a *different* tool — the case where the result would
 * otherwise go unseen. It's purely informational: navigation is via the unread
 * badge in the nav, so there's no link/CTA here. The toast persists until the
 * user dismisses it (✕) or visits the finished tool (which clears its unread
 * state); it does NOT auto-dismiss, so a user can't miss it by being slow.
 *
 * Mounted inside the persistent /tools layout (under ToolTasksProvider), so it
 * survives navigation between tools and can observe completions from anywhere.
 */
export function ToolToasts() {
  const { unreadSlugs, get } = useToolTasks();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Slugs we've already raised a toast for this unread-cycle. We re-toast only
  // after the slug leaves `unreadSlugs` (the user viewed it) and returns.
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    const current = new Set(unreadSlugs);

    // Forget slugs that are no longer unread, so a later completion re-toasts.
    for (const slug of announced.current) {
      if (!current.has(slug)) announced.current.delete(slug);
    }

    const fresh: Toast[] = [];
    for (const slug of unreadSlugs) {
      if (announced.current.has(slug)) continue;

      const tool = tools.find((t) => t.slug === slug);
      if (!tool) continue;

      // Mark announced regardless, so a tool finished while it's the active one
      // never pops a toast — now or if the user later navigates away.
      announced.current.add(slug);

      // Don't toast the tool the user is already viewing — they can see it.
      const isActive =
        pathname === tool.href || pathname.startsWith(`${tool.href}/`);
      if (isActive) continue;

      fresh.push({ slug, name: tool.name, isError: !!get(slug).error });
    }

    // Defer the state update out of the effect body (matching the tour
    // provider's idiom) so it doesn't trigger a synchronous cascading render.
    // In the same pass we drop toasts whose slug is no longer unread — visiting
    // a tool clears its unread state, so the notice goes away once it's seen.
    const id = setTimeout(() => {
      setToasts((prev) => {
        const known = new Set(prev.map((t) => t.slug));
        const kept = prev.filter((t) => current.has(t.slug));
        const added = fresh.filter((t) => !known.has(t.slug));
        if (added.length === 0 && kept.length === prev.length) return prev;
        return [...kept, ...added];
      });
    }, 0);
    return () => clearTimeout(id);
  }, [unreadSlugs, pathname, get]);

  function dismiss(slug: string) {
    setToasts((prev) => prev.filter((t) => t.slug !== slug));
  }

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.slug} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (slug: string) => void;
}) {
  return (
    // bg-black / text-white are theme-aware semantic tokens (see globals.css):
    // black page + white ink in dark mode, white page + near-black ink in light
    // mode. Using literal hex here was the light-mode "black-on-black" bug.
    <div className="pointer-events-auto overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg shadow-black/40">
      <div className="flex items-start gap-3 p-4">
        <span
          className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
            toast.isError ? "bg-coral" : "bg-teal"
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/50">
            {toast.isError ? "Request failed" : "Result ready"}
          </p>
          <p className="mt-1 truncate text-sm text-white">{toast.name}</p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.slug)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 rounded p-1 text-white/40 transition-colors hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
