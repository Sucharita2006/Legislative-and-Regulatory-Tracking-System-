"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * A lightweight spotlight "coachmark" tour of the tools area. It dims the page,
 * cuts a hole around a real UI element (located by a `data-tour` attribute),
 * and floats a tooltip beside it with Back / Next / Skip controls.
 *
 * It runs automatically the first time a user lands in /tools (tracked by a
 * localStorage flag) and can be replayed any time via the Help button, which
 * calls `startTour()` from this context.
 *
 * No external tour library — the design system is bespoke and the step set is
 * small, so a custom overlay keeps the bundle lean and on-brand.
 */

const STORAGE_KEY = "openpaws-tools-tour-seen";

type TourStep = {
  /** Matches a `data-tour="<target>"` attribute on the element to highlight. */
  target: string;
  title: string;
  body: string;
  /** Preferred tooltip side; falls back automatically if it won't fit. */
  side?: "top" | "bottom" | "left" | "right";
};

const STEPS: TourStep[] = [
  {
    target: "tools-nav",
    title: "Your toolkit",
    body: "These are the AI tools built for animal advocacy. Switch between them here at any time — Chat, Legal Research, the Key Issue Tracker, and Organization Research.",
    side: "right",
  },
  {
    target: "tools-nav-research",
    title: "Research that runs in the background",
    body: "Legal Research, Organization Research, and the Key Issue Tracker can take a few minutes. Start one, then move to another tool — a badge appears here when its answer is ready, so you never have to wait on the page.",
    side: "right",
  },
  {
    target: "tools-nav-tracker",
    title: "Ask & Digests in the Key Issue Tracker",
    body: "The Key Issue Tracker has two tabs. “Ask” queries an AI across sources and streams back findings on any advocacy issue. “Digests” lets you track issues and get them emailed to you on a daily or weekly schedule.",
    side: "right",
  },
  {
    target: "tools-nav-feedback",
    title: "Tell us what you think",
    body: "Hit a rough edge or have an idea? Send it straight to the team from here.",
    side: "right",
  },
  {
    target: "tools-help",
    title: "Replay this tour anytime",
    body: "That's the tour! You can reopen it whenever you like from this Help button.",
    side: "bottom",
  },
];

type TourContextValue = {
  /** Start (or restart) the tour from the first step. */
  startTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a ToolsTourProvider");
  return ctx;
}

type Rect = { top: number; left: number; width: number; height: number };

export function ToolsTourProvider({ children }: { children: ReactNode }) {
  // -1 means the tour is not running; 0..n-1 is the active step index.
  const [step, setStep] = useState(-1);
  const active = step >= 0;
  const current = active ? STEPS[step] : null;

  const finish = useCallback(() => {
    setStep(-1);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore persistence failures (private mode, etc.) */
    }
  }, []);

  const startTour = useCallback(() => setStep(0), []);

  // Auto-start once for first-time visitors. Runs after mount so localStorage
  // is available and the target elements have rendered.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen) {
      // Defer a tick so the layout's data-tour anchors are in the DOM.
      const t = setTimeout(() => setStep(0), 350);
      return () => clearTimeout(t);
    }
  }, []);

  const value = useMemo<TourContextValue>(() => ({ startTour }), [startTour]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && current && (
        <TourOverlay
          step={step}
          total={STEPS.length}
          stepData={current}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onNext={() =>
            setStep((s) => (s + 1 >= STEPS.length ? (finish(), -1) : s + 1))
          }
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}

const PADDING = 8; // spotlight halo around the target
const GAP = 14; // distance from spotlight to tooltip
const TOOLTIP_W = 320;

function TourOverlay({
  step,
  total,
  stepData,
  onBack,
  onNext,
  onSkip,
}: {
  step: number;
  total: number;
  stepData: TourStep;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  // Measure the target element, re-measuring on resize/scroll and whenever the
  // step changes. useLayoutEffect avoids a flash of the spotlight in the wrong
  // place before paint.
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${stepData.target}"]`,
      );
      if (!el) {
        setMissing(true);
        setRect(null);
        return;
      }
      setMissing(false);
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      // Bring the target into view if it's off-screen.
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        raf = requestAnimationFrame(measure);
      }
    };
    measure();

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [stepData.target]);

  // Close on Escape; advance with Enter/→, go back with ←.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      else if (e.key === "ArrowLeft") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip, onNext, onBack]);

  const isLast = step + 1 >= total;

  // Compute the spotlight box (with padding) and the tooltip position.
  const halo = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  const tooltipPos = halo
    ? placeTooltip(halo, stepData.side ?? "bottom")
    : centerPos();

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Dim layer with a cut-out spotlight. A huge box-shadow "fills" the page
          around the transparent halo rectangle. */}
      {halo ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-200"
          style={{
            top: halo.top,
            left: halo.left,
            width: halo.width,
            height: halo.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
            outline: "2px solid var(--color-teal)",
            outlineOffset: "0px",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/72" />
      )}

      {/* Click-catcher: clicking the dimmed area skips the tour. Sits below the
          tooltip but above the page so the underlying UI isn't interactive. */}
      <button
        type="button"
        aria-label="Close tour"
        onClick={onSkip}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      {/* Tooltip card */}
      <div
        className="absolute w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-black p-5 shadow-2xl"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-teal">
          Step {step + 1} of {total}
        </p>
        <h2 className="mt-2 font-display text-xl text-white">
          {stepData.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {stepData.body}
        </p>
        {missing && (
          <p className="mt-2 text-xs text-white/40">
            (Open the tools area to see this highlighted.)
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40 transition-colors hover:text-white/70"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-full border border-white/20 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-white hover:text-white"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="rounded-full bg-teal px-5 py-2 font-mono text-[0.65rem] font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a]"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Position the tooltip on the chosen side of the halo, clamped to the viewport. */
function placeTooltip(
  halo: Rect,
  side: "top" | "bottom" | "left" | "right",
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Rough tooltip height estimate for vertical clamping.
  const th = 220;
  const w = Math.min(TOOLTIP_W, vw - 32);

  let top: number;
  let left: number;

  switch (side) {
    case "right":
      left = halo.left + halo.width + GAP;
      top = halo.top;
      // If it would overflow the right edge, flip to the left side.
      if (left + w > vw - 16) left = halo.left - w - GAP;
      break;
    case "left":
      left = halo.left - w - GAP;
      top = halo.top;
      if (left < 16) left = halo.left + halo.width + GAP;
      break;
    case "top":
      top = halo.top - th - GAP;
      left = halo.left;
      if (top < 16) top = halo.top + halo.height + GAP;
      break;
    case "bottom":
    default:
      top = halo.top + halo.height + GAP;
      left = halo.left;
      if (top + th > vh - 16) top = halo.top - th - GAP;
      break;
  }

  // Final viewport clamp.
  left = Math.max(16, Math.min(left, vw - w - 16));
  top = Math.max(16, Math.min(top, vh - 32));
  return { top, left };
}

function centerPos(): { top: number; left: number } {
  const w = Math.min(TOOLTIP_W, window.innerWidth - 32);
  return {
    top: Math.max(16, window.innerHeight / 2 - 110),
    left: Math.max(16, window.innerWidth / 2 - w / 2),
  };
}
