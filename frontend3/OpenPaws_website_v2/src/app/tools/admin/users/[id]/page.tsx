import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Heading, SectionLabel } from "@/components/ui";
import { getAccessProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { tools } from "@/lib/tools";

export const metadata: Metadata = {
  title: "User profile",
  description: "A user's profile, as seen by admins.",
};

// Profile data must always be fresh — never serve a cached copy.
export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Read a string column defensively — it may not be migrated yet. */
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Admin-only view of one user's full profile: signup application answers,
 * org settings / custom prompt, and account status. Linked from the email
 * column on /tools/admin.
 */
export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getAccessProfile();
  if (!profile?.isAdmin) redirect("/tools");

  const { id } = await params;

  const admin = createAdminClient();
  // select("*") keeps this page working whether or not the newer profile
  // columns have been migrated; missing fields just render as "—".
  const { data: user } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!user) notFound();

  // Last sign-in lives on the auth user, not the profile. Best-effort.
  let lastSignInAt: string | null = null;
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(id);
    lastSignInAt = authUser?.user?.last_sign_in_at ?? null;
  } catch {
    // The page still renders without it.
  }

  const disabledTools = Array.isArray(user.disabled_tools)
    ? (user.disabled_tools as string[])
    : [];
  const disabledNames = tools
    .filter((t) => disabledTools.includes(t.slug))
    .map((t) => t.name);

  const sections: { label: string; value: string }[] = [
    { label: "Organization", value: str(user.organization) },
    { label: "About the organization", value: str(user.org_description) },
    { label: "Role", value: str(user.org_role) },
    { label: "Why they'd like access", value: str(user.access_reason) },
    { label: "Custom prompt", value: str(user.custom_prompt) },
  ];

  return (
    <div className="py-8">
      <SectionLabel index="00">Admin</SectionLabel>
      <Heading as="h1" className="mt-6 break-all text-4xl text-white">
        {str(user.email) || "(no email)"}
      </Heading>

      <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-xs text-white/50">
        <span
          className={`rounded-full border px-3 py-1 uppercase tracking-[0.15em] ${
            user.approved === true
              ? "border-teal/60 text-teal"
              : "border-coral/60 text-coral"
          }`}
        >
          {user.approved === true ? "Approved" : "Awaiting approval"}
        </span>
        {user.is_admin === true && (
          <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.15em] text-white/70">
            Admin
          </span>
        )}
        <span>
          Joined {formatDate(str(user.created_at) || null)} · Last sign-in{" "}
          {formatDate(lastSignInAt)}
        </span>
      </div>

      <div className="mt-10 max-w-2xl space-y-6">
        {sections.map(({ label, value }) => (
          <section
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
          >
            <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-white/40">
              {label}
            </h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-white/80">
              {value || <span className="text-white/30">—</span>}
            </p>
          </section>
        ))}

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-white/40">
            Disabled tools
          </h2>
          <p className="mt-2 leading-relaxed text-white/80">
            {disabledNames.length ? (
              disabledNames.join(", ")
            ) : (
              <span className="text-white/30">None — full access</span>
            )}
          </p>
        </section>
      </div>

      <Link
        href="/tools/admin"
        className="mt-10 inline-block font-mono text-xs uppercase tracking-[0.15em] text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
      >
        ← Back to all users
      </Link>
    </div>
  );
}
