import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui";
import { getAccessProfile } from "@/lib/auth";
import { ProfileMenu } from "./profile-menu";
import { ToolsNav } from "./tools-nav";
import { ToolTasksProvider } from "./tool-tasks";
import { ToolToasts } from "./tool-toasts";
import { ToolsTourProvider } from "./tour";
import { HelpButton } from "./help-button";

/**
 * Auth gate for all /tools routes. Unauthenticated users are redirected to
 * the Tools for Advocates page, which hosts the login form.
 */
export default async function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!configured) redirect("/tools-for-advocates");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/tools-for-advocates");

  // Signed in but not yet manually approved → hold at the pending screen.
  // (Admins pass regardless, so an un-approved admin can't be locked out.)
  const profile = await getAccessProfile();
  if (!profile || (!profile.approved && !profile.isAdmin)) {
    redirect("/account-pending");
  }

  return (
    <ToolsTourProvider>
      <header className="border-b border-white/10">
        <Container className="flex items-center justify-between py-4">
          <Link
            href="/tools"
            className="font-mono text-xs uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-white"
          >
            Your tools
          </Link>
          <div className="flex items-center gap-4">
            <HelpButton />
            <ProfileMenu email={user.email ?? null} />
          </div>
        </Container>
      </header>
      <ToolTasksProvider>
        <div className="px-4 py-8 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
            <aside className="lg:border-r lg:border-white/10 lg:pr-6">
              <ToolsNav
                disabledTools={profile.disabledTools}
                isAdmin={profile.isAdmin}
              />
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        </div>
        <ToolToasts />
      </ToolTasksProvider>
    </ToolsTourProvider>
  );
}
