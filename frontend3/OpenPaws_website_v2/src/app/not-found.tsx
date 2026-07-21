import type { Metadata } from "next";
import { Container, Heading, SectionLabel, ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page doesn't exist.",
};

/** Branded 404 — replaces the bare framework default. */
export default function NotFound() {
  return (
    <Container className="py-24">
      <div className="mx-auto max-w-md text-center">
        <span className="text-4xl" aria-hidden="true">
          🐾
        </span>
        <SectionLabel className="mt-4 block">404</SectionLabel>
        <Heading as="h1" className="mt-3 text-3xl text-white">
          Page not found
        </Heading>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          That page doesn&apos;t exist — it may have moved, or the link may be
          out of date.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href="/" variant="teal">
            Back to home
          </ButtonLink>
          <ButtonLink href="/knowledge-base" variant="outline">
            Browse the knowledge base
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
