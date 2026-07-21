import { createClient } from "@/lib/supabase/server";

/**
 * The current user's access profile, resolved in one query.
 *
 * Approval is a `profiles.approved` flag; `is_admin` unlocks the admin
 * dashboard at /tools/admin; `disabled_tools` lists tool slugs this user may
 * not use. All three are only writable by the service role (admin dashboard
 * actions) or the Supabase dashboard — RLS gives users read-only access to
 * their own row.
 */
export type AccessProfile = {
  userId: string;
  email: string | null;
  approved: boolean;
  isAdmin: boolean;
  disabledTools: string[];
};

export type AuthUser = {
  id: string;
  email: string;
};

export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

/** Null when signed out or when no profile row exists yet. */
export async function getAccessProfile(): Promise<AccessProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("approved, is_admin, disabled_tools")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;

  const profile: AccessProfile = {
    userId: user.id,
    email: user.email ?? null,
    approved: data.approved === true,
    isAdmin: data.is_admin === true,
    disabledTools: Array.isArray(data.disabled_tools)
      ? (data.disabled_tools as string[])
      : [],
  };

  console.log(`[auth] user=${profile.email} approved=${profile.approved} isAdmin=${profile.isAdmin}`);

  return profile;
}

/**
 * Whether the current user has been manually approved. Admins count as
 * approved so an admin can never lock themselves out of the dashboard.
 */
export async function isApproved(): Promise<boolean> {
  const profile = await getAccessProfile();
  return !!profile && (profile.approved || profile.isAdmin);
}

/** Whether the current user may open the admin dashboard. */
export async function isAdmin(): Promise<boolean> {
  const profile = await getAccessProfile();
  return profile?.isAdmin === true;
}

/**
 * Whether the current user may use the tool with this slug: they must be
 * approved (or an admin) and the tool must not be disabled for them.
 */
export function profileCanUseTool(
  profile: AccessProfile | null,
  slug: string,
): boolean {
  if (!profile) return false;
  if (!profile.approved && !profile.isAdmin) return false;
  return !profile.disabledTools.includes(slug);
}

/** Convenience wrapper: resolve the profile and check one tool slug. */
export async function canUseTool(slug: string): Promise<boolean> {
  return profileCanUseTool(await getAccessProfile(), slug);
}
