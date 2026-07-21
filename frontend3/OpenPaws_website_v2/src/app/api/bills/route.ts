import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";

// Proxy for public bill-data endpoints, gated to signed-in users since this
// backs the "Tools for Advocates" legislative tracker.
// GET /api/bills?path=/documents/search?from_action_date=...
// GET /api/bills?path=/documents/HR-1234
// GET /api/bills?path=/documents/HR-1234/actions
// GET /api/bills?path=/subjects/grouped

// Only these prefixes are ever actually used by the frontend; anything else
// (e.g. /users/*, /admin/*) is rejected rather than blindly proxied.
const ALLOWED_PATH_PREFIXES = ["/documents", "/subjects"];

function isAllowedPath(path: string): boolean {
  const pathname = path.split("?")[0];
  return ALLOWED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!(await canUseTool("legislative-tracker"))) {
      return NextResponse.json(
        { error: "You don't have access to this tool." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "Missing path parameter." }, { status: 400 });
    }
    if (!isAllowedPath(path)) {
      return NextResponse.json({ error: "Path not allowed." }, { status: 403 });
    }

    const res = await apiFetch(path, user.email, {});
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "The backend request failed.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
