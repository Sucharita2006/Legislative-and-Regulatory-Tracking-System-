import Image from "next/image";

/**
 * Decorative OpenPaws paw-print mark, rebuilt from the brand guide.
 * Used as a tintable background flourish (inherits `currentColor`) where the
 * full-colour logo image can't be recoloured on hover.
 */
export function PawMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      className={className}
      aria-hidden="true"
    >
      {/* toes */}
      <ellipse cx="20" cy="18" rx="6" ry="9" />
      <ellipse cx="44" cy="18" rx="6" ry="9" />
      <ellipse cx="9" cy="32" rx="6" ry="8" />
      <ellipse cx="55" cy="32" rx="6" ry="8" />
      {/* main pad */}
      <path d="M32 28c-9 0-16 6-16 14 0 6 5 10 16 10s16-4 16-10c0-8-7-14-16-14z" />
      <circle cx="32" cy="38" r="4" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  // Render both marks and let CSS pick one by the <html>.dark class. This keeps
  // the right logo visible from first paint (the no-flash theme script sets the
  // class before React hydrates), with no theme-state dependency or flicker.
  return (
    <>
      <Image
        src="/openpaws-logo-black.png"
        alt="Open Paws"
        width={600}
        height={600}
        priority
        className={`h-11 w-auto dark:hidden ${className}`}
      />
      <Image
        src="/openpaws-logo-white.webp"
        alt="Open Paws"
        width={600}
        height={600}
        priority
        className={`hidden h-11 w-auto dark:block ${className}`}
      />
    </>
  );
}
