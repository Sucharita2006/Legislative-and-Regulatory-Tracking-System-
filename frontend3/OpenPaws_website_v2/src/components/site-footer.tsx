import Link from "next/link";
import { Logo } from "./logo";
import { Container } from "./ui";
import { navLinks, siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <Container className="py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              {siteConfig.description}
            </p>
          </div>

          <nav className="flex flex-col gap-2" aria-label="Footer">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-xs uppercase tracking-[0.15em] text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={siteConfig.donateUrl}
              className="font-mono text-xs uppercase tracking-[0.15em] text-teal transition-colors hover:text-white"
            >
              Donate
            </Link>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-grey">
            Open Paws — Est. 2025
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="font-mono text-xs uppercase tracking-[0.2em] text-grey transition-colors hover:text-white"
            >
              Privacy &amp; Cookies
            </Link>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-grey">
              Building AI for Animal Advocates
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
