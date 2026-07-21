import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";

// GET /api/user?path=/users/email@x.com/prompts
// PUT /api/user?path=/users/email@x.com  (body forwarded)
// POST /api/user?path=/users/email@x.com/prompts  (body forwarded)
// DELETE /api/user?path=/users/email@x.com/prompts/id
// POST /api/user?path=/digest/send-test?email=email@x.com&... (Preferences tab "Test Run")

// Every path this proxy is allowed to forward embeds the caller's own email,
// either as the /users/{email}/... segment or an ?email= query param. We
// never trust a client-supplied email — it must match the authenticated
// Supabase session's own email, or the request is rejected.
function extractPathEmail(path: string): string | null {
  const [rawPath, query] = path.split("?");
  const usersMatch = rawPath.match(/^\/users\/([^/]+)/);
  if (usersMatch) {
    try {
      return decodeURIComponent(usersMatch[1]);
    } catch {
      return usersMatch[1];
    }
  }
  if (query) {
    const email = new URLSearchParams(query).get("email");
    if (email) return email;
  }
  return null;
}

async function handler(request: NextRequest) {
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

    if (path.startsWith("/digest/send-test")) {
      const { data: supabaseProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (!supabaseProfile?.is_admin) {
        return NextResponse.json({ error: "Forbidden: Only administrators can trigger test digests." }, { status: 403 });
      }
    }

    const pathEmail = extractPathEmail(path);
    if (!path.startsWith("/digest/send-test") && (!pathEmail || pathEmail.toLowerCase() !== user.email.toLowerCase())) {
      return NextResponse.json(
        { error: "Forbidden: you may only access your own data." },
        { status: 403 },
      );
    }

    const options: RequestInit = { method: request.method };
    if (request.method !== "GET" && request.method !== "DELETE") {
      try {
        const body = await request.text();
        if (body) options.body = body;
      } catch { /* no body */ }
    }

    const res = await apiFetch(path, user.email, options);
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

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
