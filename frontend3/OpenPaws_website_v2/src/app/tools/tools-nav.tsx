"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tools } from "@/lib/tools";
import { useToolTasks } from "./tool-tasks";

/**
 * Left-rail navigation listing the advocate tools, highlighting the active
 * one. Tools an admin has disabled for this user are hidden entirely (the
 * server enforces access too — hiding is just the UX). Admins get an extra
 * link to the admin dashboard.
 */
export function ToolsNav({
  disabledTools = [],
  isAdmin = false,
}: {
  disabledTools?: string[];
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const { unreadSlugs, runningSlugs } = useToolTasks();

  const base =
    "rounded-lg px-3 py-2.5 text-sm transition-colors whitespace-nowrap";

  const visibleTools = tools.filter((t) => !disabledTools.includes(t.slug));

  return (
    <nav className="flex flex-col gap-1" data-tour="tools-nav">
      <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-grey">
        Tools
      </p>
      {visibleTools.map((tool) => {
        const isLive = tool.status === "live";
        // Active when on the tool's own route (or a sub-route of it).
        const isActive =
          isLive &&
          (pathname === tool.href || pathname.startsWith(`${tool.href}/`));
        const isUnread = unreadSlugs.includes(tool.slug);
        const isRunning = runningSlugs.includes(tool.slug);

        const inner = (
          <span className="flex w-full items-center gap-3">
            <span className="text-lg" aria-hidden="true">
              {tool.icon}
            </span>
            <span className="flex-1">{tool.name}</span>
            {tool.external && (
              <span className="text-white/30" aria-label="Opens in a new tab">
                ↗
              </span>
            )}
            {isUnread && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal px-1.5 font-mono text-[0.65rem] font-medium text-on-teal"
                aria-label="New result ready"
              >
                1
              </span>
            )}
            {/* Pulsing dot while a request runs in the background, so the
                promised "a badge will appear" has a visible in-progress state. */}
            {isRunning && !isUnread && (
              <span
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-teal"
                role="status"
                aria-label="Running in the background"
              />
            )}
          </span>
        );

        if (!isLive) {
          return (
            <span
              key={tool.slug}
              aria-disabled="true"
              title="Coming soon"
              className={`${base} cursor-default text-white/30`}
            >
              {inner}
            </span>
          );
        }

        return (
          <Link
            key={tool.slug}
            href={tool.href}
            aria-current={isActive ? "page" : undefined}
            // Anchor tour steps to specific tools in the nav: the first
            // background-research tool, and the key issue tracker.
            data-tour={
              tool.slug === "legal-research"
                ? "tools-nav-research"
                : tool.slug === "key-issue-tracker"
                  ? "tools-nav-tracker"
                  : undefined
            }
            className={`${base} ${
              isActive
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
            {...(tool.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {inner}
          </Link>
        );
      })}

      {/* Admin dashboard link — only rendered for admins. */}
      {isAdmin && (
        <Link
          href="/tools/admin"
          aria-current={
            pathname.startsWith("/tools/admin") ? "page" : undefined
          }
          className={`${base} mt-4 border-t border-white/10 pt-4 ${
            pathname.startsWith("/tools/admin")
              ? "bg-white/10 text-white"
              : "text-white/60 hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="text-lg" aria-hidden="true">
              🛠️
            </span>
            <span>Admin</span>
          </span>
        </Link>
      )}

      {/* Profile and feedback aren't tools, so they sit below the tools list. */}
      <Link
        href="/tools/settings"
        aria-current={pathname === "/tools/settings" ? "page" : undefined}
        className={`${base} mt-4 border-t border-white/10 pt-4 ${
          pathname === "/tools/settings"
            ? "bg-white/10 text-white"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="text-lg" aria-hidden="true">
            👤
          </span>
          <span>Profile</span>
        </span>
      </Link>
      <Link
        href="/tools/feedback"
        data-tour="tools-nav-feedback"
        aria-current={pathname === "/tools/feedback" ? "page" : undefined}
        className={`${base} ${
          pathname === "/tools/feedback"
            ? "bg-white/10 text-white"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="text-lg" aria-hidden="true">
            💬
          </span>
          <span>Feedback</span>
        </span>
      </Link>
    </nav>
  );
}
