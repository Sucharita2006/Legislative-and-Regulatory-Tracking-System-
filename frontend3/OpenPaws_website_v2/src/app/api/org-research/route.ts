import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";
import { startToolRun } from "@/lib/tool-runs";
import { getOrgSettings, orgWebhookFields } from "@/lib/org-settings";

// The default URL is the live, always-on production webhook — despite the
// "webhook-test" path segment, this is not an n8n test webhook. The tool works
// out of the box; override via N8N_ORG_RESEARCH_WEBHOOK_URL only to repoint it.
const N8N_URL =
  process.env.N8N_ORG_RESEARCH_WEBHOOK_URL ??
  "https://n8n.openpaws.ai/webhook-test/org-osint";

// We don't hold the connection while n8n works — just trigger it and return.
export const maxDuration = 30;

/**
 * Organization research (OSINT) tool (async). The OSINT workflow runs many slow
 * steps, longer than a serverless function may live, so we don't stream it. We
 * create a pending tool_run, fire the n8n `org-osint` webhook (which posts its
 * result back to /api/tool-runs/callback when done), and return the run id for
 * the browser to poll via /api/tool-runs/{id}.
 */
export async function POST(request: NextRequest) {
  if (!N8N_URL) {
    return NextResponse.json(
      { error: "Org research is not configured (missing N8N_ORG_RESEARCH_WEBHOOK_URL)." },
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
  if (!(await canUseTool("org-research"))) {
    return NextResponse.json(
      { error: "You don't have access to this tool." },
      { status: 403 },
    );
  }

  let companyName = "";
  let companyDomain = "";
  let reportGoal = "";
  try {
    const body = await request.json();
    companyName = String(body?.companyName ?? "").trim();
    companyDomain = String(body?.companyDomain ?? "").trim();
    reportGoal = String(body?.reportGoal ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!companyName) {
    return NextResponse.json({ error: "A company name is required." }, { status: 400 });
  }

  try {
    // The user's saved org context (from /tools/settings) rides along in the
    // webhook payload so the workflow can tailor its output.
    const runId = await startToolRun({
      tool: "org-research",
      webhookUrl: N8N_URL,
      input: {
        companyName,
        companyDomain,
        reportGoal,
        ...orgWebhookFields(await getOrgSettings()),
      },
    });
    return NextResponse.json({ runId });
  } catch {
    return NextResponse.json(
      { error: "The research service is unavailable right now. Please try again." },
      { status: 502 },
    );
  }
}
