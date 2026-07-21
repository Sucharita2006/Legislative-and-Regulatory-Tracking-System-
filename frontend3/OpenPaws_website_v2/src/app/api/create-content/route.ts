import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";
import { getOrgSettings, orgWebhookFields } from "@/lib/org-settings";

// The default URL is the live, always-on production webhook. Override via
// N8N_CREATE_CONTENT_WEBHOOK_URL only to repoint it.
const N8N_URL =
  process.env.N8N_CREATE_CONTENT_WEBHOOK_URL ??
  "https://n8n.openpaws.ai/webhook/create-content";

// Header-auth secret for the n8n webhook node, sent as `x-webhook-auth`.
const AUTH_SECRET = process.env.N8N_CREATE_CONTENT_AUTH_SECRET;

// The content workflow can take a while (6+ min); keep the function alive.
// 800s is the Vercel Pro ceiling for maxDuration.
export const maxDuration = 800;

/** One generated content variant, as returned by the create-content webhook. */
type Variant = { text: string; score: number | null };

/**
 * Pull content variants out of whatever the webhook returns. The known shape is
 * `{ output: [{ score, text }, ...] }`, but the workflow may also hand back a
 * bare array, a single object, or a plain string — so we probe a few shapes and
 * keep anything that carries text.
 */
function extractVariants(data: unknown): Variant[] {
  const toVariant = (item: unknown): Variant | null => {
    if (typeof item === "string") {
      const text = item.trim();
      return text ? { text, score: null } : null;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const raw = o.text ?? o.content ?? o.output;
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) return null;
      const score = Number(o.score);
      return { text, score: Number.isFinite(score) ? score : null };
    }
    return null;
  };

  // { output: [...] } — the documented shape.
  const list =
    data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).output)
      ? ((data as Record<string, unknown>).output as unknown[])
      : Array.isArray(data)
        ? data
        : [data];

  return list.map(toVariant).filter((v): v is Variant => v !== null);
}

/**
 * Content-generation tool. Forwards the advocate's instructions to the n8n
 * `create-content` webhook along with their email as `user`, then returns the
 * generated variants. The `user` field is taken from the authenticated session,
 * never the request body, so it can't be spoofed.
 */
export async function POST(request: NextRequest) {
  if (!N8N_URL) {
    return NextResponse.json(
      { error: "Content generation is not configured (missing N8N_CREATE_CONTENT_WEBHOOK_URL)." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await canUseTool("create-content"))) {
    return NextResponse.json(
      { error: "You don't have access to this tool." },
      { status: 403 },
    );
  }

  let instructions = "";
  try {
    const body = await request.json();
    instructions = String(body?.instructions ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!instructions) {
    return NextResponse.json(
      { error: "Tell us what content to create." },
      { status: 400 },
    );
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (AUTH_SECRET) headers["x-webhook-auth"] = AUTH_SECRET;

  let upstream: Response;
  try {
    upstream = await fetch(N8N_URL, {
      method: "POST",
      headers,
      // The next n8n node reads $json.body.instructions and $json.body.user;
      // organization / customPrompt (from /tools/settings) are included when
      // set so the workflow can tailor the content.
      body: JSON.stringify({
        instructions,
        user: user.email,
        ...orgWebhookFields(await getOrgSettings()),
      }),
      // Just under maxDuration, so we abort with a clean message before Vercel
      // hard-kills the function. Long because the workflow can take 6+ min.
      signal: AbortSignal.timeout(790_000),
    });
  } catch (err) {
    const timedOut = (err as Error)?.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut
          ? "Content generation is taking longer than expected. Please try again in a few minutes."
          : "The content service is unavailable right now. Please try again.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `The content service returned an error (${upstream.status}).` },
      { status: 502 },
    );
  }

  // The webhook may return JSON or plain text depending on the workflow.
  const ctype = upstream.headers.get("content-type") ?? "";
  let data: unknown;
  if (ctype.includes("application/json")) {
    try {
      data = await upstream.json();
    } catch {
      return NextResponse.json(
        { error: "The content service returned a malformed response." },
        { status: 502 },
      );
    }
  } else {
    data = await upstream.text();
  }

  const variants = extractVariants(data);
  if (variants.length === 0) {
    return NextResponse.json(
      { error: "The request finished but returned no content." },
      { status: 502 },
    );
  }

  // Best variants first.
  variants.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
  return NextResponse.json({ variants });
}
