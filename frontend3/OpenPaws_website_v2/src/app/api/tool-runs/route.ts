import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listToolRuns } from "@/lib/tool-runs";

export const runtime = "nodejs";
// History must reflect runs completed moments ago; never cache.
export const dynamic = "force-dynamic";

/**
 * List the signed-in user's past runs of one tool (?tool=legal-research),
 * newest first. Backs the history side panel on the research tools. RLS
 * scopes the query to the user's own rows.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const tool = request.nextUrl.searchParams.get("tool")?.trim();
  if (!tool) {
    return NextResponse.json(
      { error: "A ?tool= query parameter is required." },
      { status: 400 },
    );
  }

  const runs = await listToolRuns(tool);
  return NextResponse.json(
    { runs },
    { headers: { "Cache-Control": "no-store" } },
  );
}
