"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/tools-for-advocates/actions";

/**
 * Top-right profile button for the tools header. Opens a small dropdown with
 * the signed-in email, a link to the profile page (org info + custom prompt),
 * and sign out.
 */
export function ProfileMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = email?.[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        title="Profile"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-9 items-center justify-center rounded-full border font-mono text-sm transition-colors ${
          open
            ? "border-teal bg-teal/15 text-teal"
            : "border-white/20 text-white/70 hover:border-white hover:text-white"
        }`}
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-white/10 bg-black p-2 shadow-xl"
        >
          <p className="break-all px-3 py-2 font-mono text-xs text-white/40">
            {email ?? "(no email)"}
          </p>
          <Link
            role="menuitem"
            href="/tools/settings"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <span aria-hidden="true" className="mr-2">
              👤
            </span>
            Profile &amp; custom prompt
          </Link>
          <form action={logout}>
            <button
              role="menuitem"
              type="submit"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span aria-hidden="true" className="mr-2">
                ↪
              </span>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
