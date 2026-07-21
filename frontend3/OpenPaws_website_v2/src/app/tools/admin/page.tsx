import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Heading, SectionLabel } from "@/components/ui";
import { getAccessProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable, type AdminUser } from "./users-table";

export const metadata: Metadata = {
  title: "Admin",
  description: "Manage user accounts and tool access.",
};

// The user list must always be fresh — never serve a cached copy.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await getAccessProfile();
  if (!profile?.isAdmin) redirect("/tools");

  const admin = createAdminClient();

  // The signup-application columns may not be migrated yet — the dashboard
  // must keep working regardless, so fall back to the pre-migration shape.
  // The two selects infer different row types, hence the explicit common shape.
  type ProfileRow = {
    id: string;
    email: string | null;
    approved: boolean | null;
    is_admin: boolean | null;
    disabled_tools: unknown;
    created_at: string;
    org_description?: string | null;
    org_role?: string | null;
    access_reason?: string | null;
    organization?: string | null;
    custom_prompt?: string | null;
  };
  let { data: profiles, error } = (await admin
    .from("profiles")
    .select(
      "id, email, approved, is_admin, disabled_tools, created_at, org_description, org_role, access_reason, organization, custom_prompt",
    )
    .order("created_at", { ascending: false })) as {
    data: ProfileRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    ({ data: profiles, error } = (await admin
      .from("profiles")
      .select("id, email, approved, is_admin, disabled_tools, created_at")
      .order("created_at", { ascending: false })) as {
      data: ProfileRow[] | null;
      error: { message: string } | null;
    });
  }
  if (error) throw new Error(`Could not load users: ${error.message}`);

  // Last sign-in lives on the auth user, not the profile. Best-effort: if the
  // lookup fails the dashboard still renders, just without that column filled.
  const lastSignIn = new Map<string, string | null>();
  const { data: authUsers } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  for (const u of authUsers?.users ?? []) {
    lastSignIn.set(u.id, u.last_sign_in_at ?? null);
  }

  const users: AdminUser[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: (p.email as string | null) ?? null,
    approved: p.approved === true,
    isAdmin: p.is_admin === true,
    disabledTools: Array.isArray(p.disabled_tools)
      ? (p.disabled_tools as string[])
      : [],
    createdAt: p.created_at as string,
    lastSignInAt: lastSignIn.get(p.id as string) ?? null,
    orgDescription:
      typeof p.org_description === "string" ? p.org_description : "",
    orgRole: typeof p.org_role === "string" ? p.org_role : "",
    accessReason: typeof p.access_reason === "string" ? p.access_reason : "",
    organization: typeof p.organization === "string" ? p.organization : "",
    customPrompt: typeof p.custom_prompt === "string" ? p.custom_prompt : "",
  }));

  return (
    <div className="py-8">
      <SectionLabel index="00">Admin</SectionLabel>
      <Heading as="h1" className="mt-6 text-4xl text-white sm:text-5xl">
        Manage <span className="italic">users</span>
      </Heading>
      <p className="mt-6 max-w-2xl leading-relaxed text-white/70">
        Approve accounts, choose which tools each user can access, and send
        password resets. Changes take effect the next time the user loads a
        page.
      </p>

      <UsersTable users={users} currentUserId={profile.userId} />
    </div>
  );
}
