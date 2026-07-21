import { Container, Heading, SectionLabel, ButtonLink } from "@/components/ui";
import { PawMark } from "@/components/logo";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="grain relative overflow-hidden border-b border-white/10">
        {/* Teal atmospheric glow — "a glow, a light source, a tint". */}
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-teal/20 blur-[120px]"
          aria-hidden="true"
        />
        <Container className="relative z-10 flex flex-col items-start py-28 sm:py-36">
          <SectionLabel index="01">Introduction</SectionLabel>
          <Heading
            as="h1"
            className="mt-6 max-w-4xl text-5xl text-white sm:text-7xl"
          >
            Building AI for{" "}
            <span className="italic">Animal Advocates</span>
          </Heading>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            Open source tools, hackathons, and research to power the animal
            advocacy movement.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ButtonLink href="/tools-for-advocates" variant="teal">
              Use Our Tools
            </ButtonLink>
            <ButtonLink href="/tools-for-developers" variant="outline">
              Help Us Build
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Mission */}
      <section className="border-b border-white/10 py-24">
        <Container className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:items-start">
          <div>
            <SectionLabel index="02">Our Mission</SectionLabel>
            <Heading className="mt-4 text-3xl text-white sm:text-4xl">
              Technology meets
              <br />
              <span className="italic">compassion</span>
            </Heading>
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-white/70">
            <p>
              Open Paws is an open-source initiative building AI tools,
              hackathons, and research to power the animal advocacy movement.
              We work at the intersection of technology and compassion.
            </p>
            <p>
              We believe the tools that will accelerate the movement should be
              built in the open, by the community, for the animals. Whether you
              are an advocate looking for tools or a developer looking to build
              them, there is a place for you here.
            </p>
          </div>
        </Container>
      </section>

      {/* Two paths */}
      <section className="py-24">
        <Container>
          <SectionLabel index="03">Two Ways In</SectionLabel>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <PathCard
              href="/tools-for-advocates"
              kicker="For Advocates"
              title="Use our tools"
              body="Practical AI tools to make your advocacy work faster, sharper, and further-reaching."
              cta="Explore the tools"
            />
            <PathCard
              href="/tools-for-developers"
              kicker="For Developers"
              title="Help us build"
              body="Contribute to open-source tools, join a hackathon, and build AI for the movement."
              cta="Start building"
            />
          </div>
        </Container>
      </section>
    </>
  );
}

function PathCard({
  href,
  kicker,
  title,
  body,
  cta,
}: {
  href: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <a
      href={href}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-8 transition-colors hover:border-teal/60"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 text-white/[0.03] transition-colors group-hover:text-teal/10"
        aria-hidden="true"
      >
        <PawMark className="h-48 w-48" />
      </div>
      <div className="relative z-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal">
          {kicker}
        </p>
        <Heading className="mt-3 text-3xl text-white">{title}</Heading>
        <p className="mt-4 max-w-sm text-white/60">{body}</p>
      </div>
      <span className="relative z-10 mt-8 font-mono text-xs uppercase tracking-[0.15em] text-white/70 group-hover:text-white">
        {cta} →
      </span>
    </a>
  );
}
