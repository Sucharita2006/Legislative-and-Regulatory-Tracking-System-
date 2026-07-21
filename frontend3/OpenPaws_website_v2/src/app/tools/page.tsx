import type { Metadata } from "next";
import Link from "next/link";
import { Heading, SectionLabel } from "@/components/ui";
import { tools } from "@/lib/tools";
import { getAccessProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Tools",
  description: "AI tools for animal advocates.",
};

export default async function ToolsHubPage() {
  // Hide tools an admin has disabled for this user (the layout has already
  // verified they're signed in and approved).
  const profile = await getAccessProfile();
  const visibleTools = tools.filter(
    (t) => !profile?.disabledTools.includes(t.slug),
  );

  return (
    <div className="py-8">
      <SectionLabel index="01">For Advocates</SectionLabel>
      <Heading as="h1" className="mt-6 text-5xl text-white sm:text-6xl">
        Your <span className="italic">tools</span>
      </Heading>
      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70">
        AI tools built for animal advocacy. More are on the way.
      </p>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {visibleTools.map((tool) => {
          const isLive = tool.status === "live";
          const card = (
            <div
              className={`flex h-full flex-col justify-between rounded-2xl border p-8 transition-colors ${
                isLive
                  ? "border-white/10 hover:border-teal/60"
                  : "border-white/10 opacity-60"
              }`}
            >
              <div>
                <span className="text-3xl" aria-hidden="true">
                  {tool.icon}
                </span>
                <Heading className="mt-4 text-2xl text-white">
                  {tool.name}
                </Heading>
                <p className="mt-3 text-white/60">{tool.description}</p>
              </div>
              <span className="mt-8 font-mono text-xs uppercase tracking-[0.15em] text-white/70">
                {isLive ? (tool.external ? "Open ↗" : "Open →") : "Coming soon"}
              </span>
            </div>
          );

          return isLive ? (
            <Link
              key={tool.slug}
              href={tool.href}
              className="group"
              {...(tool.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {card}
            </Link>
          ) : (
            <div key={tool.slug} aria-disabled="true">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
