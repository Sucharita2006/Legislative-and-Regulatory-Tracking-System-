import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";
import { startToolRun } from "@/lib/tool-runs";
import { getOrgSettings, orgWebhookFields } from "@/lib/org-settings";

const N8N_URL = process.env.N8N_LEGAL_RESEARCH_WEBHOOK_URL;

// We don't hold the connection while n8n works — just trigger it and return.
export const maxDuration = 30;

/**
 * Legal-research tool (async). The n8n workflow can run far longer than a
 * serverless function may live, so we don't stream it. Instead we create a
 * pending tool_run, fire the webhook (which posts its result back to
 * /api/tool-runs/callback when done), and return the run id for the browser to
 * poll via /api/tool-runs/{id}.
 */
export async function POST(request: NextRequest) {
  if (!N8N_URL) {
    return NextResponse.json(
      { error: "Legal research is not configured (missing N8N_LEGAL_RESEARCH_WEBHOOK_URL)." },
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
  if (!(await canUseTool("legal-research"))) {
    return NextResponse.json(
      { error: "You don't have access to this tool." },
      { status: 403 },
    );
  }

  let prompt = "";
  try {
    const body = await request.json();
    prompt = String(body?.prompt ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }

  try {
    // The user's saved org context (from /tools/settings) rides along in the
    // webhook payload so the workflow can tailor its output.
    const runId = await startToolRun({
      tool: "legal-research",
      webhookUrl: N8N_URL,
      input: { prompt, ...orgWebhookFields(await getOrgSettings()) },
    });
    return NextResponse.json({ runId });
  } catch {
    return NextResponse.json(
      { error: "The research service is unavailable right now. Please try again." },
      { status: 502 },
    );
  }
}
