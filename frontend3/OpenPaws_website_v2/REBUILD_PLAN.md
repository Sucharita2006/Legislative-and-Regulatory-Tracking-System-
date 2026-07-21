# Open Paws Website Rebuild — Project Plan

**Date:** 2026-06-15
**Owner:** christoph@openpaws.ai
**Current site:** https://www.openpaws.ai/ (hosted on Squarespace)

---

## 1. Goals

Rebuild openpaws.ai as a custom-coded site to get:

- **New design / branding** — modern, fast, on-brand look.
- **Better performance & SEO** — outperform the Squarespace build.
- **Lower cost & full control** — own the code; run on free/cheap tiers.
- **A foundation for future tools** — user signup + calling external n8n
  workflows (later phase, not now).

**Non-goals (explicitly out of scope):**

- No e-commerce / store. The current Squarespace cart is dropped entirely.
- No third-party CMS (no Sanity). Content lives on the site itself.
- No custom Stripe donation flow. Donate is an external link for now.

---

## 2. Stack

| Concern        | Choice                  | Why |
|----------------|-------------------------|-----|
| Framework      | **Next.js** (App Router)| Smooth path to the future app-like AI tools (auth, API routes to n8n). |
| Hosting        | **Vercel**              | Free tier, git-push deploys, global CDN, preview URLs. |
| Styling        | **Tailwind CSS**        | Fast to build a design system; small, consistent output. Brand tokens (§8) wired into `tailwind.config`. |
| Content (blog/KB) | **Self-hosted** — Markdown/MDX now, **built-in `/admin` editor later** | No third-party tools; staff-editable in a later phase. |
| Auth           | **Supabase Auth** (in MVP) | Real user signup/login wired during the MVP — powers the Tools-for-Activists login now. Free tier. |
| n8n (later)    | Next.js API routes / server actions calling n8n webhooks | Keeps n8n URLs & secrets off the client. |
| Donate         | External link           | Simplest; no compliance burden. |

### Maintainer reality check

The site should ultimately be editable by **non-technical staff**, but the
constraint of "no third-party tools" means we can't use a hosted CMS. The
resolution:

- **MVP (today):** blog/KB articles are Markdown/MDX files in the repo. Fast,
  free, zero infra. (Editing requires git/GitHub for now.)
- **Phase later:** add a password-protected **`/admin` editor** — a simple
  on-site form to write/edit posts — so non-tech staff don't touch code. This
  needs a small bit of storage (a lightweight DB or committing files back to
  the repo); decided when we build it.

---

## 3. Site map

```
/                       Homepage
/tools-for-advocates    Landing page + LOGIN functionality (stub for now)
/tools-for-developers   Landing page with links out
/knowledge-base         Article list (blog/KB index)
/knowledge-base/[slug]  Individual article
Donate                  External link (in nav/footer), not a page
```

### Content carried over from the current site

- **H1:** "Building AI for Animal Advocates"
- **Tagline:** "Open source tools, hackathons, and research to power the
  animal advocacy movement."
- **CTAs:** "Use Our Tools" → /tools-for-advocates, "Help Us Build" →
  /tools-for-developers
- **Nav:** Tools for Advocates · Tools for Developers · Knowledge Base · Donate
- Dark, tech-focused hero imagery (animal-friendly AI / farmed animals theme).

---

## 4. MVP scope (today)

Ship a deployable site on a **Vercel preview URL** (DNS cutover happens later).

1. **Project foundation**
   - Scaffold Next.js + Tailwind, init git, connect to Vercel for
     auto-deploy on push.
   - Implement the **design system from the brand guide (§8)**: color tokens,
     the three fonts (DM Serif Display, Space Grotesk, JetBrains Mono), and
     base components: Nav, Footer, Button, Container.

2. **Homepage**
   - Hero (H1 + tagline + two CTAs), mission section, links into the two
     tools pages.

3. **Tools for Advocates** — landing page **with real signup/login (Supabase)**
   - Marketing/landing content + working **Supabase Auth**: email/password
     (and optionally OAuth) signup, login, logout, and session handling. For
     the MVP this is the auth entry point; the actual tools come later, but the
     account system is real from day one.

4. **Tools for Developers** — landing page
   - Short intro + a list of links (GitHub, hackathons, research, etc.).

5. **Knowledge Base**
   - Index page listing articles + individual article pages, rendered from
     Markdown/MDX files in the repo. Seed with 1–2 sample posts.

6. **Nav + Footer + Donate link** wired across all pages.

**MVP success = all of the above live on the Vercel preview URL, fast, mobile-responsive.**

---

## 5. Phased roadmap

### Phase 0 — Capture (quick)
- Inventory current pages, copy, and images; download hero/assets.
- Record existing URLs for later redirect mapping (SEO preservation).
- Note domain/DNS + analytics so nothing is lost at cutover.

### Phase 1 — Foundation (today)
- Scaffold, git, Vercel pipeline, design system, shared layout.

### Phase 2 — MVP pages + real auth (today)
- Homepage, Tools for Advocates (landing + **real Supabase signup/login**),
  Tools for Developers, Knowledge Base (Markdown). Deploy to preview URL.
- Set up Supabase project, wire env vars, signup/login/logout + protected
  session, and a basic post-login state.

### Phase 3 — Content authoring upgrade
- Build the self-hosted **`/admin` editor** so non-tech staff can create/edit
  posts without git. (Can reuse the Supabase auth from Phase 2 to gate it.)

### Phase 4 — Launch / cutover
- SEO pass: metadata, sitemap.xml, robots.txt, Open Graph, structured data.
- Accessibility + performance audit (Lighthouse).
- **Redirects** from old Squarespace URLs → new URLs.
- Point DNS at Vercel. Monitor.

### Phase 5 — Tools (later)
- Build on the **existing Supabase auth** (already live from Phase 2) — gate
  the real activist tools behind login, add user roles/profiles as needed.
- Next.js API routes / server actions that call the externally-hosted **n8n**
  workflows (secrets stored server-side as env vars).

---

## 6. SEO & cost notes

- **SEO:** keep URL slugs sensible now; build the old→new redirect map before
  DNS cutover so search ranking transfers. Add sitemap, metadata, OG tags in
  Phase 4.
- **Budget:** Next.js + Vercel free tier + Markdown content = effectively $0
  until traffic/features grow. Auth and any DB for the `/admin` editor are the
  first things that might incur small costs — both have free tiers.

---

## 7. Open questions (to resolve before/while building)

1. **Supabase setup:** ✅ User will create the project and add
   `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env`.
   Auth method: **email/password only** (no OAuth for now). Scaffolded with
   placeholder env vars meanwhile.
2. **Developer links:** what exact links go on Tools for Developers (GitHub
   org, hackathon page, research/papers, Discord/Slack)?
3. **Branding:** ✅ Resolved — applying the official OpenPaws.ai Brand Identity
   guide (see §8). User will provide the **logo SVG/PNG**; using a placeholder
   paw mark until then.
4. **`/admin` editor storage (Phase 3):** commit Markdown back to the repo, or
   use a small database? Affects hosting choices.
5. **Donate URL:** the exact external donation link to use.

---

## 8. Design system (from the OpenPaws.ai Brand Identity guide)

> Guiding rule: *"When in doubt, remove colour before adding more. The brand
> should read as white space, black clarity, teal confidence, and a single
> warm accent only when the message earns it."*

Aesthetic: retro-futuristic sci-fi — grainy, cinematic, monochrome base with a
single deep-teal accent.

### Colour tokens

**Core**
| Token | Hex | Use |
|-------|-----|-----|
| `black`  | `#000000` | Authority, text & logo; **default background** |
| `white`  | `#FFFFFF` | Core background (light pages); text on dark |
| `teal`   | `#006C67` | **Primary accent** — CTA fills, links, active states, dividers, badges, logo symbol. Works on both dark & white. |
| `grey`   | `#888888` | Secondary text |

**Warm accents — white-background layouts ONLY, one per layout, never on dark**
| Token | Hex | Use |
|-------|-----|-----|
| `coral` | `#FF8552` | Campaign highlights, alerts, urgency |
| `gold`  | `#D19900` | Badges, awards, data highlights |
| `peach` | `#FFE1D1` | Callouts, quotes, testimonials |

Rules:
- **Dark pages** (default): black bg, white body text, teal for actions/highlights. **No warm accents on dark.**
- **White pages:** white bg, black text, teal for CTAs/links. **One** warm accent per layout — never coral + gold + teal at equal strength.
- Warm accents are **background fills only**, always paired with black text — never used as text colour on white.

### Typography

| Role | Font | Notes |
|------|------|-------|
| Display / headlines | **DM Serif Display** (serif) | Massive scale, authority + warmth; major headings, hero, editorial. Has an italic. |
| Body / interface | **Space Grotesk** | Body copy, navigation, UI, all informational text. Weights 300–700. |
| Utility / labels | **JetBrains Mono** | Section numbers, metadata, labels, technical annotations (e.g. `[SECTION 03] — TYPOGRAPHY`). Reinforces the data-driven, open-source feel. |

All three are free Google Fonts → load via `next/font` (self-hosted, no layout shift, no third-party request).

### Logo

- The **paw print** mark + "OPEN PAWS" wordmark is the core identity.
- **Clear space:** minimum margin around the logo = the height of the "O" in "OPEN".
- Never place on busy backgrounds without a sufficient dark overlay.
- Teal may be used for the logo symbol.

### Imagery — "Together, never alone"

- High-contrast **black & white** with **heavy analog film grain** — should feel like expired 35mm stock: tactile, imperfect, warm.
- Show **groups** of animals (packs, herds, flocks, pods) — never solitary; a group reads as a movement.
- Where possible, **people + animals together** (the human–animal bond).
- **Teal** appears only as a subtle atmospheric accent — a glow, a light source, a tint — never as a heavy overlay.

### How this maps to the build

- Tailwind `theme.extend.colors` = the tokens above; `fontFamily` = the three fonts via `next/font`.
- Default site theme is **dark** (black bg / white text / teal accents), matching the current hero.
- Build a `<SectionLabel>` mono component for the `[SECTION 0X]` annotations, a serif `<Heading>`, and a teal-filled `<Button>`.
- Apply a film-grain overlay treatment to hero/imagery sections.
- Reserve warm-accent (coral/gold/peach) styling for specific white-background callout components, used sparingly.
```
