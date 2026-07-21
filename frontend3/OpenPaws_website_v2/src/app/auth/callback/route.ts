import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback for email links (password recovery, email confirmation).
 * Supabase appends a `code` that we exchange for a session, then redirect the
 * user to `next` (defaults to the tools page).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/tools-for-advocates";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or exchange failed → send back to login with a hint.
  return NextResponse.redirect(
    `${origin}/tools-for-advocates?error=auth_callback`,
  );
}
