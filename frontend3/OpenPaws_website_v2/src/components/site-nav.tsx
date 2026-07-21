"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./logo";
import { Container } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { navLinks, siteConfig } from "@/lib/site";

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <Container>
        <nav className="flex h-16 items-center justify-between" aria-label="Main">
          <Link href="/" onClick={() => setOpen(false)} aria-label="Open Paws home">
            <Logo />
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-xs uppercase tracking-[0.15em] text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={siteConfig.donateUrl}
              className="rounded-full bg-teal px-5 py-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal transition-colors hover:bg-[#00807a]"
            >
              Donate
            </Link>
            <ThemeToggle />
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="text-white"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <div className="space-y-1.5">
                <span
                  className={`block h-0.5 w-6 bg-white transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
                />
                <span
                  className={`block h-0.5 w-6 bg-white transition-opacity ${open ? "opacity-0" : ""}`}
                />
                <span
                  className={`block h-0.5 w-6 bg-white transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
                />
              </div>
            </button>
          </div>
        </nav>
      </Container>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 bg-black md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-2 font-mono text-sm uppercase tracking-[0.15em] text-white/80 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={siteConfig.donateUrl}
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-teal px-5 py-3 text-center font-mono text-xs font-medium uppercase tracking-[0.15em] text-on-teal"
            >
              Donate
            </Link>
          </Container>
        </div>
      )}
    </header>
  );
}
