import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container, Heading, SectionLabel, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { isApproved } from "@/lib/auth";
import { AuthForm } from "./auth-form";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "Tools for Advocates",
  description:
    "Sign in to access Open Paws AI tools built for animal advocates.",
};

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Who to ask when approval is taking too long (same contact as /privacy). */
const CONTACT_EMAIL = "christoph@openpaws.ai";

export default async function ToolsForAdvocatesPage() {
  let userEmail: string | null = null;
  let approved = false;

  if (SUPABASE_CONFIGURED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
    if (user) approved = await isApproved();
  }

  // A signed-in, approved user has no business on the login page — skip the
  // "Welcome back / Open your tools" card and go straight to the tools.
  // Signed-in but unapproved users still see the awaiting-approval card.
  if (userEmail && approved) redirect("/tools");

  return (
    <Container className="py-24">
      <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
        {/* Left: landing copy */}
        <div>
          <SectionLabel index="01">For Advocates</SectionLabel>
          <Heading as="h1" className="mt-6 text-5xl text-white sm:text-6xl">
            Tools that work
            <br />
            <span className="italic">as hard as you do</span>
          </Heading>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-white/70">
            Open Paws builds AI tools to make animal advocacy faster, sharper,
            and further-reaching. Sign in to get access.
          </p>
          <ul className="mt-8 space-y-3 text-white/60">
            <Bullet>Research and content assistance</Bullet>
            <Bullet>Campaign and outreach support</Bullet>
            <Bullet>More tools rolling out soon</Bullet>
          </ul>
        </div>

        {/* Right: auth or signed-in state */}
        <div className="flex justify-center lg:justify-end">
          {!SUPABASE_CONFIGURED ? (
            <ConfigNotice />
          ) : userEmail ? (
            <AwaitingApproval email={userEmail} />
          ) : (
            <AuthForm />
          )}
        </div>
      </div>
    </Container>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
      <span>{children}</span>
    </li>
  );
}

/**
 * Card for a signed-in but not-yet-approved user. (Approved users never see
 * this page — they're redirected straight to /tools above.)
 */
function AwaitingApproval({ email }: { email: string }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8">
      <SectionLabel>Account pending</SectionLabel>
      <Heading className="mt-3 text-2xl text-white">Awaiting approval</Heading>
      <p className="mt-2 break-all font-mono text-sm text-white/60">{email}</p>
      <p className="mt-6 text-sm leading-relaxed text-white/70">
        Your email is confirmed. An admin will review your account shortly —
        you&apos;ll be able to access the tools once approved.
      </p>
      <p className="mt-3 text-xs text-white/50">
        Questions, or waiting longer than expected?{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-teal underline underline-offset-2 hover:text-white"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
      <form action={logout} className="mt-6">
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8">
      <SectionLabel>Setup needed</SectionLabel>
      <Heading className="mt-3 text-2xl text-white">Connect Supabase</Heading>
      <p className="mt-4 text-sm leading-relaxed text-white/70">
        Add your Supabase credentials to <code className="font-mono text-teal">.env</code> to
        enable signup &amp; login:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-black p-4 font-mono text-xs text-white/70">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
      </pre>
    </div>
  );
}
