"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tools } from "@/lib/tools";
import {
  deleteUser,
  sendPasswordReset,
  setUserAdmin,
  setUserApproved,
  setUserToolAccess,
  type AdminActionResult,
} from "./actions";

export type AdminUser = {
  id: string;
  email: string | null;
  approved: boolean;
  isAdmin: boolean;
  disabledTools: string[];
  createdAt: string;
  lastSignInAt: string | null;
  /** Signup application answers, shown to inform the approval decision. */
  orgDescription: string;
  orgRole: string;
  accessReason: string;
  /** Profile fields the user edits on /tools/settings. */
  organization: string;
  customPrompt: string;
};

/** Trim long profile text for the hover preview card. */
function excerpt(s: string, max = 220): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

type Notice = { kind: "ok" | "error"; text: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** One labelled line in the email hover-preview card; hidden when empty. */
function ProfilePreviewItem({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

/** Small pill-style toggle used for the approved / admin / tool switches. */
function Toggle({
  on,
  label,
  disabled,
  title,
  onChange,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  title?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`rounded-full border px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        on
          ? "border-teal/60 bg-teal/15 text-teal"
          : "border-white/15 text-white/40 hover:border-white/40 hover:text-white/70"
      }`}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

/**
 * Interactive user list for the admin dashboard. Every control calls a server
 * action (which re-verifies the caller is an admin) and then refreshes the
 * server-rendered list, so what's shown always reflects the database.
 */
export function UsersTable({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // id of the row whose action is in flight, so only that row dims.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState("");
  // Two-step delete: first click arms the button ("Confirm?"), second deletes.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Only internal tools are gated by APIs, but hiding external links works
  // the same way, so every tool in the registry is toggleable.
  const toggleableTools = tools;

  const run = (
    userId: string,
    okText: string,
    action: () => Promise<AdminActionResult>,
  ) => {
    setBusyId(userId);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (result.ok) {
        setNotice({ kind: "ok", text: okText });
        router.refresh();
      } else {
        setNotice({ kind: "error", text: result.error });
      }
    });
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? users.filter((u) => (u.email ?? "").toLowerCase().includes(q))
    : users;

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by email…"
          className="w-full max-w-xs rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
        />
        <p className="font-mono text-xs text-white/40">
          {visible.length} of {users.length} user{users.length === 1 ? "" : "s"}
        </p>
      </div>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-4 font-mono text-sm ${
            notice.kind === "error" ? "text-coral" : "text-teal"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Approved</th>
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Tools</th>
              <th className="px-4 py-3 font-medium">Password</th>
              <th className="px-4 py-3 font-medium">Delete</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = isPending && busyId === user.id;
              return (
                <tr
                  key={user.id}
                  className={`border-b border-white/5 align-top last:border-0 ${
                    busy ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    {/* The email links to the full profile page; hovering it
                        shows a quick profile preview card. */}
                    <div className="group relative inline-block">
                      <Link
                        href={`/tools/admin/users/${user.id}`}
                        className="break-all text-white underline-offset-4 hover:text-teal hover:underline"
                      >
                        {user.email ?? "(no email)"}
                      </Link>
                      {isSelf && (
                        <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40">
                          you
                        </span>
                      )}
                      <div className="pointer-events-none invisible absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/15 bg-black p-4 opacity-0 shadow-xl transition-opacity delay-150 group-hover:visible group-hover:opacity-100">
                        <dl className="space-y-2 text-xs leading-relaxed text-white/70">
                          <ProfilePreviewItem
                            label="Organization"
                            value={user.organization}
                          />
                          <ProfilePreviewItem
                            label="About the org"
                            value={excerpt(user.orgDescription)}
                          />
                          <ProfilePreviewItem label="Role" value={user.orgRole} />
                          <ProfilePreviewItem
                            label="Why access"
                            value={excerpt(user.accessReason)}
                          />
                          <ProfilePreviewItem
                            label="Custom prompt"
                            value={excerpt(user.customPrompt)}
                          />
                          {!user.organization &&
                            !user.orgDescription &&
                            !user.orgRole &&
                            !user.accessReason &&
                            !user.customPrompt && (
                              <p className="text-white/40">
                                No profile details yet.
                              </p>
                            )}
                        </dl>
                        <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/40">
                          Click to open full profile
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 font-mono text-xs text-white/40">
                      Joined {formatDate(user.createdAt)} · Last sign-in{" "}
                      {formatDate(user.lastSignInAt)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <Toggle
                      on={user.approved}
                      label={`Approved: ${user.email ?? user.id}`}
                      disabled={busy}
                      onChange={(next) =>
                        run(
                          user.id,
                          next
                            ? `Approved ${user.email ?? "user"}.`
                            : `Un-approved ${user.email ?? "user"}.`,
                          () => setUserApproved(user.id, next),
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Toggle
                      on={user.isAdmin}
                      label={`Admin: ${user.email ?? user.id}`}
                      disabled={busy || (isSelf && user.isAdmin)}
                      title={
                        isSelf && user.isAdmin
                          ? "You can't remove your own admin access."
                          : undefined
                      }
                      onChange={(next) =>
                        run(
                          user.id,
                          next
                            ? `${user.email ?? "User"} is now an admin.`
                            : `Removed admin from ${user.email ?? "user"}.`,
                          () => setUserAdmin(user.id, next),
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {toggleableTools.map((tool) => {
                        const enabled = !user.disabledTools.includes(tool.slug);
                        return (
                          <button
                            key={tool.slug}
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            disabled={busy}
                            title={`${tool.name}: ${enabled ? "enabled" : "disabled"}`}
                            onClick={() =>
                              run(
                                user.id,
                                `${enabled ? "Disabled" : "Enabled"} ${tool.name} for ${user.email ?? "user"}.`,
                                () =>
                                  setUserToolAccess(
                                    user.id,
                                    tool.slug,
                                    !enabled,
                                  ),
                              )
                            }
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                              enabled
                                ? "border-teal/60 text-white"
                                : "border-white/10 text-white/30 line-through hover:border-white/40"
                            }`}
                          >
                            <span aria-hidden="true">{tool.icon}</span>{" "}
                            {tool.name}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      disabled={busy || !user.email}
                      onClick={() =>
                        run(
                          user.id,
                          `Reset link sent to ${user.email}.`,
                          () => sendPasswordReset(user.id),
                        )
                      }
                      className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-white hover:text-white disabled:pointer-events-none disabled:opacity-40"
                    >
                      Send reset link
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    {confirmDeleteId === user.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setConfirmDeleteId(null);
                            run(
                              user.id,
                              `Deleted ${user.email ?? "user"}.`,
                              () => deleteUser(user.id),
                            );
                          }}
                          className="whitespace-nowrap rounded-full border border-coral bg-coral/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-coral transition-colors hover:bg-coral/25 disabled:pointer-events-none disabled:opacity-40"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-white hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || isSelf}
                        title={
                          isSelf
                            ? "You can't delete your own account."
                            : `Permanently delete ${user.email ?? "this user"} and all their data.`
                        }
                        onClick={() => setConfirmDeleteId(user.id)}
                        className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-coral hover:text-coral disabled:pointer-events-none disabled:opacity-40"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center font-mono text-sm text-white/40"
                >
                  No users match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
