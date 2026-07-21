import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getToolRun, hideToolRun } from "@/lib/tool-runs";

export const runtime = "nodejs";
// Polled frequently; never cache.
export const dynamic = "force-dynamic";

/**
 * Status of one async tool run, polled by the browser until it's terminal.
 * RLS scopes the lookup to the signed-in user, so a user can only read their
 * own runs.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const run = await getToolRun(id);
  if (!run) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: run.id,
      tool: run.tool,
      status: run.status,
      result: run.result,
      error: run.error,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Remove one run from the user's history panel. This is a soft delete — the
 * row survives as a log; only its `hidden` flag flips (see hideToolRun).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const hidden = await hideToolRun(id);
  if (!hidden) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
