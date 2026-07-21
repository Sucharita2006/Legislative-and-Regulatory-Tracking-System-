import type { Metadata } from "next";
import Script from "next/script";
import type { DetailedHTMLProps, HTMLAttributes } from "react";
import { Container, Heading, SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support Open Paws — fund open-source AI tools, hackathons, and research for the animal advocacy movement.",
};

// The Donorbox embed renders into a custom element (<dbox-widget>) hydrated by
// donorbox.org/widgets.js. Declare it so TSX accepts the unknown tag.
type DboxWidgetProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  campaign?: string;
  type?: string;
  "enable-auto-scroll"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "dbox-widget": DboxWidgetProps;
    }
  }
}

export default function DonatePage() {
  return (
    <>
      {/* Donorbox widget loader. afterInteractive defers it past first-party
          hydration; the id lets Next dedupe it across client navigations. */}
      <Script
        id="donorbox-widgets"
        src="https://donorbox.org/widgets.js"
        type="module"
        strategy="afterInteractive"
      />

      <section className="border-b border-white/10 py-20 sm:py-24">
        <Container>
          <SectionLabel index="01">Support the work</SectionLabel>
          <Heading as="h1" className="mt-6 max-w-3xl text-4xl text-white sm:text-5xl">
            Fund AI built <span className="italic">for the animals</span>
          </Heading>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            Open Paws is open source and community-driven. Your donation funds the
            tools, hackathons, and research that power the animal advocacy
            movement.
          </p>
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container className="max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-2 sm:p-4">
            <dbox-widget
              campaign="open-paws-donations"
              type="donation_form"
              enable-auto-scroll="true"
            />
          </div>
          <noscript>
            <p className="mt-6 text-center text-sm text-white/60">
              The donation form needs JavaScript. You can also donate directly at{" "}
              <a
                href="https://donorbox.org/open-paws-donations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal underline underline-offset-2"
              >
                donorbox.org/open-paws-donations
              </a>
              .
            </p>
          </noscript>
        </Container>
      </section>
    </>
  );
}
