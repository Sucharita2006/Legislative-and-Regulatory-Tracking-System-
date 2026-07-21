import { NextResponse, type NextRequest } from "next/server";
import { BACKEND_URL } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await canUseTool("legislative-tracker"))) {
    return NextResponse.json(
      { error: "You don't have access to this tool." },
      { status: 403 },
    );
  }

  let prompt: string;
  let date: string | null;
  try {
    const body = await request.json();
    prompt = String(body?.prompt ?? "").trim();
    date = body?.date ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/search/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, date, user_email: user.email }),
      signal: AbortSignal.timeout(290_000),
    });
  } catch {
    return NextResponse.json(
      { error: "The backend is unavailable right now. Please try again." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    let message = `Backend returned an error (${res.status}).`;
    try { const d = await res.json(); if (d?.detail) message = d.detail; } catch { /* ignore */ }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
