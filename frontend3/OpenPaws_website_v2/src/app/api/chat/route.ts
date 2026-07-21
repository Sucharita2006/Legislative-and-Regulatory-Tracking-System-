import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";
import { getOrgSettings } from "@/lib/org-settings";

const N8N_URL = process.env.N8N_CHAT_WEBHOOK_URL;

// The n8n workflow + LLM can be slow; keep the function alive long enough.
export const maxDuration = 800;

/** Pull the assistant's text out of whatever (non-streamed) shape n8n returns. */
function extractReply(data: unknown): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const r = extractReply(item);
      if (r) return r;
    }
    return "";
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["output", "response", "answer", "text", "message", "reply"]) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) return v;
      if (v && typeof v === "object") {
        const nested = extractReply(v);
        if (nested) return nested;
      }
    }
  }
  return "";
}

/** Extract a text token from a single streamed NDJSON event, if it carries one. */
function tokenFromEvent(evt: unknown): string {
  if (!evt || typeof evt !== "object") return "";
  const o = evt as Record<string, unknown>;
  // n8n's streaming shape: { type: "item", content: "..." }. Be liberal about
  // the field name so minor workflow differences still surface text.
  if (o.type && o.type !== "item") return "";
  for (const key of ["content", "text", "delta", "token", "output"]) {
    if (typeof o[key] === "string") return o[key] as string;
  }
  return "";
}

const encoder = new TextEncoder();
/** Serialize one event as a line of NDJSON for the browser. */
function ndjson(event: Record<string, unknown>): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n");
}

export async function POST(request: NextRequest) {
  if (!N8N_URL) {
    return NextResponse.json(
      { error: "Chat is not configured (missing N8N_CHAT_WEBHOOK_URL)." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await canUseTool("chat"))) {
    return NextResponse.json(
      { error: "You don't have access to this tool." },
      { status: 403 },
    );
  }

  let body: { sessionId?: string; query?: string; customInstructions?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  const customInstructions = (body.customInstructions ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Query is required." }, { status: 400 });
  }

  // Resolve or create the session (owned by this user).
  let sessionId = body.sessionId;
  if (sessionId) {
    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!existing) sessionId = undefined; // not theirs / gone — start fresh
  }
  if (!sessionId) {
    const title = query.length > 60 ? query.slice(0, 57) + "…" : query;
    const { data: created, error: createErr } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: "Could not create chat session." },
        { status: 500 },
      );
    }
    sessionId = created.id as string;
  }
  // At this point sessionId is guaranteed set (resolved or freshly created).
  const resolvedSessionId: string = sessionId as string;

  // Save the user's message.
  await supabase.from("chat_messages").insert({
    session_id: resolvedSessionId,
    user_id: user.id,
    role: "user",
    content: query,
  });

  // The user's saved org context (from /tools/settings) rides along on every
  // request: the custom prompt merges into `customInstructions` (which the
  // workflow already reads), and the org name goes as its own field.
  const org = await getOrgSettings();
  const mergedInstructions = [org.customPrompt, customInstructions]
    .filter(Boolean)
    .join("\n\n");

  // Call the n8n workflow. The Supabase session UUID doubles as the n8n
  // sessionId, giving stable per-conversation memory tied to stored chats.
  let upstream: Response;
  try {
    upstream = await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: resolvedSessionId,
        query,
        customInstructions: mergedInstructions || undefined,
        // customPrompt is deliberately NOT sent as its own field here — it's
        // already merged into customInstructions above.
        organization: org.organization || undefined,
      }),
      signal: AbortSignal.timeout(790_000),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "The assistant took too long to respond. Please try again."
        : "The assistant is unavailable right now. Please try again.";
    return NextResponse.json({ error: message, sessionId: resolvedSessionId }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `The assistant returned an error (${upstream.status}).`, sessionId: resolvedSessionId },
      { status: 502 },
    );
  }

  // Persist the assistant reply once we've collected the full text, and bump
  // the session's updated_at so the sidebar reorders.
  async function persist(reply: string) {
    const finalReply = (reply || "").trim() || "(No response.)";
    await supabase.from("chat_messages").insert({
      session_id: resolvedSessionId,
      user_id: user!.id,
      role: "assistant",
      content: finalReply,
    });
    await supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", resolvedSessionId);
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const isStream =
    contentType.includes("ndjson") ||
    contentType.includes("event-stream") ||
    contentType.includes("text/plain");

  // Whichever upstream shape we get, we emit a uniform NDJSON stream to the
  // browser: a `begin` (carrying the sessionId), one or more `item` tokens,
  // then `end`. The client renders `item` content as it arrives.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(ndjson({ type: "begin", sessionId: resolvedSessionId }));

      let accumulated = "";
      const emitText = (text: string) => {
        if (!text) return;
        accumulated += text;
        controller.enqueue(ndjson({ type: "item", content: text }));
      };

      try {
        if (isStream) {
          // Pipe the upstream NDJSON stream through, extracting text tokens.
          const reader = upstream.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line) continue;
              try {
                emitText(tokenFromEvent(JSON.parse(line)));
              } catch {
                // Non-JSON line (e.g. a leading "200" or raw text chunk):
                // forward it verbatim so plain-text streams still work.
                if (line !== "200") emitText(line);
              }
            }
          }
          // Flush any trailing partial line.
          const tail = buffer.trim();
          if (tail && tail !== "200") {
            try {
              emitText(tokenFromEvent(JSON.parse(tail)));
            } catch {
              emitText(tail);
            }
          }
        } else {
          // Buffered (non-streaming) upstream: read it all and emit once, so the
          // client still gets a valid stream and nothing breaks.
          const text = await upstream.text();
          let reply: string;
          try {
            reply = extractReply(JSON.parse(text));
          } catch {
            reply = text; // plain-text response
          }
          emitText(reply);
        }
      } catch {
        controller.enqueue(
          ndjson({ type: "error", content: "The connection to the assistant was interrupted." }),
        );
      }

      // Persist BEFORE closing the stream: the platform may freeze/kill the
      // function as soon as the response finishes, so anything awaited after
      // close() only runs if the runtime happens to stay alive — replies were
      // intermittently never saved. Holding the final "end" event for the
      // ~100ms the insert takes keeps the function alive until the write lands.
      try {
        await persist(accumulated);
      } catch {
        // A failed save shouldn't break the reply the user already has.
      }

      controller.enqueue(ndjson({ type: "end" }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Session-Id": resolvedSessionId,
    },
  });
}
