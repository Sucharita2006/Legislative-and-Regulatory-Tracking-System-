import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container, Heading, SectionLabel, Button, ButtonLink } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { isApproved } from "@/lib/auth";
import { logout } from "@/app/tools-for-advocates/actions";

export const metadata: Metadata = {
  title: "Account pending",
  description: "Your account is awaiting approval.",
};

/** Who to ask when approval is taking too long (same contact as /privacy). */
const CONTACT_EMAIL = "christoph@openpaws.ai";

export default async function AccountPendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → send to login. Already approved → straight to the tools.
  if (!user) redirect("/tools-for-advocates");
  if (await isApproved()) redirect("/tools");

  return (
    <Container className="py-24">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <span className="text-4xl" aria-hidden="true">
          ⏳
        </span>
        <SectionLabel className="mt-4 block">Account pending</SectionLabel>
        <Heading className="mt-3 text-2xl text-white">
          Thanks for signing up
        </Heading>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          Your account is awaiting approval. An admin will review it shortly —
          you&apos;ll be able to access the tools once approved.
        </p>
        <p className="mt-2 break-all font-mono text-xs text-white/40">
          {user.email}
        </p>
        <p className="mt-4 text-xs text-white/50">
          Questions, or waiting longer than expected?{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-teal underline underline-offset-2 hover:text-white"
          >
            {CONTACT_EMAIL}
          </a>
        </p>

        <div className="mt-8 space-y-3">
          <ButtonLink href="/tools" variant="teal" className="w-full">
            Check again
          </ButtonLink>
          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </Container>
  );
}
