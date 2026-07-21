import "server-only";

/**
 * Build the digest research prompt sent to the general-research webhook.
 *
 * This is the prompt that used to live in the n8n workflow (with `{{ $json[…] }}`
 * / `{{ $now }}` expressions). Now that the digest loop is orchestrated on
 * Vercel and reads the tracked issue straight from Supabase, we assemble it here
 * and pass the finished text as `prompt`. The n8n expressions are substituted
 * with the row's
 * own columns:
 *   {{ $json['Update Topics'] }}        → the issue's topics (the `title` column)
 *   {{ $json['Update Instructions'] }}  → the user's instructions (the `prompt` column)
 *   {{ $now }}                          → the current time, supplied by the caller
 *
 * Recency is enforced by the n8n Serper node(s), which pin the `tbs` date filter
 * (e.g. `qdr:d`, past 24h) — the prompt does NOT set it and explicitly tells the
 * agent not to. The prompt's job is query *construction*, which is where recall
 * actually breaks:
 *   - Run a NEWS search on the bare topic (no "vegan"/"vegetarian" words) for
 *     real journalism; adding advocacy words to a news query empties it.
 *   - Run a WEB search on the topic + `vegan OR vegetarian` for community /
 *     social-media sentiment.
 *   - Keep queries short (2–4 words) and retry-on-empty; long keyword pile-ups
 *     under a 24h filter are the #1 cause of zero results.
 *
 * NOTE: the two-search strategy assumes the agent has BOTH a news and a web
 * Serper tool. If n8n only exposes one (web) search node, the news half is a
 * no-op until a `/news` node is added — see docs/digests.md.
 */
export function buildDigestPrompt({
  topics,
  instructions,
  now = new Date(),
}: {
  topics: string;
  instructions: string;
  now?: Date;
}): string {
  return `Your job is to research news and updates strictly from the past 24 hours using the Serper search tools. The tools already apply a "past 24 hours" date filter automatically — you do NOT need to set any date, time, or "tbs" parameter yourself.

**How to search — read carefully, this is where queries usually go wrong:**
The search tools take ONLY natural-language keywords. Pass plain keywords as the query and nothing else.

- Do NOT put any date filter, "tbs", "tbm", "qdr", "cdr", "type", "&", or JSON/URL syntax into the query. The tools handle dates for you.
- Do NOT wrap the topic in quotes (e.g. "Food Industry Shifts") — that forces an exact-phrase match that articles almost never contain, and returns zero results. Use plain keywords instead.

**Run TWO kinds of search for each topic — they surface different things:**

1. **News search — the topic keywords ALONE, with NO "vegan"/"vegetarian" words added.**
   Use the news search for real journalism and articles. Search the plain topic (e.g. \`cultivated meat\`, \`factory farming policy\`, \`alternative protein funding\`). Do NOT append "vegan", "vegetarian", "animal rights", or "veganism" to a news query — those extra words filter out most real news coverage and leave you with nothing. Judge each result's relevance to animal advocacy yourself from the article; you do not need the query to contain advocacy words.
   - Right (news): cultivated meat
   - Right (news): egg prices bird flu
   - Wrong (news, too narrow — returns nothing): cultivated meat animal rights vegetarianism veganism

2. **Web search — the topic keywords PLUS \`vegan OR vegetarian\`.**
   Use the web search to catch community, sentiment, and social-media discussion (Instagram, TikTok, Reddit, Facebook, blogs). HERE you should append \`vegan OR vegetarian\` so the results are tied to the movement (e.g. \`cultivated meat vegan OR vegetarian\`, \`corporate campaign vegan OR vegetarian\`).
   - Right (web): plant-based milk vegan OR vegetarian
   - Right (web): factory farming vegan OR vegetarian

Keep every query SHORT — 2–4 topic words (plus the \`vegan OR vegetarian\` suffix only on the web search). A single wide query almost always returns nothing under the 24-hour filter; breadth comes from running many short queries, not one long one.

**If a query returns no results, do NOT give up on that topic after one try.** Reformulate — drop a word, use a synonym, or try the other search kind — and try 2–3 different variations before concluding there's genuinely no news for it. A single empty result usually means the query was worded too narrowly, not that nothing happened. Do not return articles published outside the past 24 hours.

You are searching for news and articles on the following topics, but **only as they relate to animal rights, animal welfare, vegetarianism, and veganism**. Translate each topic into natural keywords (do not search the topic label as a literal quoted phrase):

${topics}

Also consider the additional context of the user's instructions for the type of information they want you to find:

${instructions}

The current date and time is ${now.toISOString()}.

**Your final answer should:**
- Be as long and detailed as possible.
- Include every direct URL you find, using exactly the same URL string returned by the tools.
- Never modify, shorten, omit, or "clean up" URLs in any way.
- Clearly list all URLs, even if they appear multiple times.

**Research requirements:**
- Make MANY search calls — for each topic run both a news search (bare topic) and a web search (topic + \`vegan OR vegetarian\`), plus a few keyword variations. Do not stop at one query per topic.
- Prefer news-search articles for the substance of each item; use web-search results to add community/sentiment context.
- Use scraping tools (text scraping, URL scraping) on the sites you find to extract additional details, but never fabricate or alter URLs.
- If a website blocks scraping (e.g. a login wall), acknowledge this and proceed with the tool's snippet — do not invent content you couldn't read.

**Prohibited behavior:**
- Never say "I don't have access to real-time news data or current internet content" or similar disclaimers.
- Never guess or invent URLs.

**IMPORTANT:** Always include every URL exactly as found by the tools, without any changes.`;
}

/**
 * Fire the general-research webhook for one digest WITHOUT awaiting completion.
 *
 * Mirrors `startToolRun` (lib/tool-runs.ts): the digest cron can't hold a
 * connection open for the ~6-minute research, so it triggers n8n and returns.
 * We pass `digestRunId` + `callbackUrl` so the workflow's final HTTP-Request
 * node can POST the report back to /api/cron/digests/callback, which then
 * stores it, emails it, and stamps last_sent_at.
 *
 * n8n's webhook responds only when the whole workflow ends, so our short
 * timeout firing (TimeoutError) is the EXPECTED "accepted, running" path. A
 * genuine connection error means n8n is unreachable, which we surface so the
 * caller can log the issue as failed-to-trigger.
 */
export async function fireDigestResearch({
  prompt,
  digestRunId,
  callbackUrl,
  timeoutMs = 8_000,
}: {
  prompt: string;
  digestRunId: string;
  callbackUrl: string;
  timeoutMs?: number;
}): Promise<void> {
  const url = process.env.N8N_GENERAL_RESEARCH_WEBHOOK_URL;
  if (!url) throw new Error("Missing N8N_GENERAL_RESEARCH_WEBHOOK_URL.");

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, digestRunId, callbackUrl }),
      // Just long enough to catch an immediate connection failure. n8n won't
      // respond before then (it runs for minutes), so a timeout = accepted.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if ((err as Error)?.name === "TimeoutError") return; // accepted, running
    throw err; // couldn't reach n8n at all
  }
  // Responded within the window (e.g. "respond immediately" mode) — fine; the
  // callback still delivers the report.
}
