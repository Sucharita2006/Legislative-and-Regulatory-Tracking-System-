"use client";

import { useTour } from "./tour";

/** Header button that (re)starts the tools tour. */
export function HelpButton() {
  const { startTour } = useTour();
  return (
    <button
      type="button"
      data-tour="tools-help"
      onClick={startTour}
      className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-white hover:text-white"
    >
      <span
        aria-hidden="true"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[0.6rem]"
      >
        ?
      </span>
      Help
    </button>
  );
}
