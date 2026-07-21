import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Max-width content wrapper with responsive horizontal padding. */
export function Container({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Mono utility label, e.g. `[01] — INTRODUCTION`.
 * Mirrors the brand guide's section annotations.
 */
export function SectionLabel({
  index,
  children,
  className = "",
}: {
  index?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-xs uppercase tracking-[0.25em] text-grey ${className}`}
    >
      {index ? `[${index}] — ` : ""}
      {children}
    </span>
  );
}

/** Serif display heading. `as` controls the rendered tag. */
export function Heading({
  as: Tag = "h2",
  className = "",
  children,
}: {
  as?: "h1" | "h2" | "h3";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={`font-display leading-[1.05] tracking-tight ${className}`}>
      {children}
    </Tag>
  );
}

type ButtonVariant = "teal" | "outline";

const variantClasses: Record<ButtonVariant, string> = {
  // Teal is the action layer — primary CTA fill. Label stays light on teal.
  teal: "bg-teal text-on-teal hover:bg-[#00807a] focus-visible:outline-teal",
  // Outline for secondary actions; foreground-aware in both themes.
  outline:
    "border border-white/30 text-white hover:border-white hover:bg-white/5 focus-visible:outline-white",
};

const baseButton =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 " +
  "font-mono text-xs font-medium uppercase tracking-[0.15em] transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none";

/** Button rendered as an internal/external link. */
export function ButtonLink({
  href,
  variant = "teal",
  external = false,
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const classes = `${baseButton} ${variantClasses[variant]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/** Button rendered as a real <button> (for forms/actions). */
export function Button({
  variant = "teal",
  className = "",
  children,
  ...props
}: { variant?: ButtonVariant } & ComponentProps<"button">) {
  return (
    <button
      className={`${baseButton} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
