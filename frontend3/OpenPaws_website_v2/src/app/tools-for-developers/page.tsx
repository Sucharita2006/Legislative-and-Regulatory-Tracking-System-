import type { Metadata } from "next";
import { Container, Heading, SectionLabel, ButtonLink } from "@/components/ui";
import { developerResources, developerSignupUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Tools for Developers",
  description:
    "Open Paws has built a full-stack, open-source ecosystem for developers working on behalf of animals.",
};

export default function ToolsForDevelopersPage() {
  return (
    <>
      {/* Hero */}
      <section className="grain relative overflow-hidden border-b border-white/10">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-teal/15 blur-[120px]"
          aria-hidden="true"
        />
        <Container className="relative z-10 py-24 sm:py-28">
          <SectionLabel index="01">For Developers</SectionLabel>
          <Heading as="h1" className="mt-6 max-w-4xl text-5xl text-white sm:text-6xl">
            Everything you need to{" "}
            <span className="italic">build AI for animals</span>
          </Heading>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70">
            Open Paws has built a full-stack, open-source ecosystem for
            developers working on behalf of animals. Everything here is
            production-ready, tested in live campaigns, and freely available to
            use, remix, or build upon.
          </p>
        </Container>
      </section>

      {/* Ecosystem */}
      <section className="py-24">
        <Container>
          <SectionLabel index="02">The Ecosystem</SectionLabel>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {developerResources.map((res) => (
              <a
                key={res.title}
                href={res.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-2xl border border-white/10 p-8 transition-colors hover:border-teal/60"
              >
                <div>
                  <span className="text-3xl" aria-hidden="true">
                    {res.icon}
                  </span>
                  <Heading className="mt-4 text-2xl text-white">
                    {res.title}
                  </Heading>
                  <p className="mt-3 text-white/60">{res.description}</p>
                </div>
                <span className="mt-8 font-mono text-xs uppercase tracking-[0.15em] text-white/70 group-hover:text-white">
                  {res.cta} →
                </span>
              </a>
            ))}
          </div>
        </Container>
      </section>

      {/* Build with us */}
      <section className="border-t border-white/10 py-24">
        <Container>
          <SectionLabel index="03">Build With Us</SectionLabel>
          <Heading className="mt-4 max-w-xl text-3xl text-white sm:text-4xl">
            Want to <span className="italic">build with us?</span>
          </Heading>
          <p className="mt-4 max-w-xl text-white/70">
            Join the community of developers building open-source AI for the
            animal advocacy movement. Fill out the form below and we&apos;ll be
            in touch.
          </p>

          {/* Visible escape hatch above the embed: the Google Form iframe can
              render blank (CSP / third-party-cookie settings), and a footnote
              below ~1200px of empty space is easy to miss. */}
          <div className="mt-6">
            <ButtonLink href={developerSignupUrl} external variant="outline">
              Open the form in a new tab ↗
            </ButtonLink>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <iframe
              src={`${developerSignupUrl}?embedded=true`}
              title="Build with us — Open Paws developer signup form"
              className="h-[1200px] w-full"
              loading="lazy"
            >
              Loading…
            </iframe>
          </div>
        </Container>
      </section>
    </>
  );
}
