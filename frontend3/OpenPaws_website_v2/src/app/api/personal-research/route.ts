import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseTool } from "@/lib/auth";
import { startToolRun } from "@/lib/tool-runs";

// The n8n "Create a profile" (Humantic) workflow's production webhook.
// Override via N8N_PERSONAL_RESEARCH_WEBHOOK_URL only to repoint it.
const N8N_URL =
  process.env.N8N_PERSONAL_RESEARCH_WEBHOOK_URL ??
  "https://n8n.openpaws.ai/webhook/346b0589-df41-4a04-bdc4-b8fb3b81a08b";

// We don't hold the connection while n8n works — just trigger it and return.
export const maxDuration = 30;

/**
 * Personal research tool (async). Profiles a person from their LinkedIn URL
 * (used as the Humantic user id) plus name and company. Same shape as
 * org-research: create a pending tool_run, fire the n8n webhook (which posts
 * its result back to /api/tool-runs/callback when done), and return the run id
 * for the browser to poll via /api/tool-runs/{id}.
 *
 * Payload keys (linkedinURL, firstName, …) are the workflow's contract — they
 * must match what the n8n webhook node reads. runId and callbackUrl ride along
 * for the workflow's final HTTP-Request node.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await canUseTool("personal-research"))) {
    return NextResponse.json(
      { error: "You don't have access to this tool." },
      { status: 403 },
    );
  }

  let linkedinURL = "";
  let firstName = "";
  let lastName = "";
  let companyName = "";
  let companyDomain = "";
  let reportGoal = "";
  try {
    const body = await request.json();
    linkedinURL = String(body?.linkedinURL ?? "").trim();
    firstName = String(body?.firstName ?? "").trim();
    lastName = String(body?.lastName ?? "").trim();
    companyName = String(body?.companyName ?? "").trim();
    companyDomain = String(body?.companyDomain ?? "").trim();
    reportGoal = String(body?.reportGoal ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!linkedinURL.includes("linkedin.com/in/")) {
    return NextResponse.json(
      { error: "Please enter a LinkedIn profile URL (…linkedin.com/in/…)." },
      { status: 400 },
    );
  }
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 },
    );
  }
  if (!companyName || !companyDomain) {
    return NextResponse.json(
      { error: "Company name and domain are required." },
      { status: 400 },
    );
  }

  try {
    const runId = await startToolRun({
      tool: "personal-research",
      webhookUrl: N8N_URL,
      // reportGoal is optional — an empty string means "no specific goal" and
      // the workflow should fall back to its default report structure.
      input: { linkedinURL, firstName, lastName, companyName, companyDomain, reportGoal },
    });
    return NextResponse.json({ runId });
  } catch {
    return NextResponse.json(
      { error: "The research service is unavailable right now. Please try again." },
      { status: 502 },
    );
  }
}
