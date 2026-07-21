import type { Metadata } from "next";
import { Container, Heading, SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy & Cookies",
  description:
    "How Open Paws handles your data, what cookies and local storage we use, and your choices.",
};

// Shown to readers and used to date the policy. Update when the policy changes.
const LAST_UPDATED = "June 21, 2026";
const CONTACT_EMAIL = "christoph@openpaws.ai";

export default function PrivacyPage() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="max-w-3xl">
        <SectionLabel index="01">Legal</SectionLabel>
        <Heading as="h1" className="mt-6 text-4xl text-white sm:text-5xl">
          Privacy &amp; <span className="italic">Cookies</span>
        </Heading>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.15em] text-white/40">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="prose-paws mt-10">
          <p>
            Open Paws builds open-source AI tools for animal advocates. We try to
            collect as little as possible about you, and we don&rsquo;t use
            advertising or third-party tracking. This page explains what we
            store, why, and the choices you have.
          </p>

          <h2>What we collect</h2>
          <p>
            We only collect what we need to run the site and the advocate tools:
          </p>
          <ul>
            <li>
              <strong>Account information.</strong> When you sign up for the
              advocate tools, we store your email address and authentication
              details so you can log in. Accounts are reviewed and approved
              manually.
            </li>
            <li>
              <strong>Your tool activity.</strong> Questions you submit to the
              tools (chat, legal research, the key issue tracker, and
              organization research) are processed to generate a response. Chat
              conversations are saved to your account so you can revisit them.
            </li>
          </ul>
          <p>
            We do <strong>not</strong> use analytics, advertising, or
            social-media tracking cookies, and we do not sell your data.
          </p>

          <h2>Cookies</h2>
          <p>
            We use cookies that are <strong>strictly necessary</strong> for the
            site to work. We do not use any optional, analytics, or advertising
            cookies, so there is no cookie consent banner to click through.
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Purpose</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Supabase authentication cookies (e.g.{" "}
                    <code>sb-&lt;project&gt;-auth-token</code>)
                  </td>
                  <td>
                    Keep you signed in to the advocate tools and refresh your
                    session securely as you browse.
                  </td>
                  <td>Strictly necessary</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            These are set by our authentication provider,{" "}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Supabase
            </a>
            , which processes login data on our behalf.
          </p>

          <h2>Local storage</h2>
          <p>
            We also keep a couple of small preferences in your browser&rsquo;s
            local storage. These never leave your device and are not sent to our
            servers:
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>openpaws-theme</code>
                  </td>
                  <td>Remembers your light or dark mode choice.</td>
                </tr>
                <tr>
                  <td>
                    <code>openpaws-tools-tour-seen</code>
                  </td>
                  <td>
                    Remembers that you&rsquo;ve seen the guided tour of the
                    tools, so it doesn&rsquo;t reappear automatically.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>How your data is used</h2>
          <p>
            We use the information above to authenticate you, to run the tools
            you ask for, and to maintain and improve the service. Some requests
            are processed by trusted infrastructure providers (for example, our
            hosting and workflow-automation services) solely to deliver the
            feature you&rsquo;re using.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>
              <strong>Cookies.</strong> You can clear or block cookies in your
              browser settings, but the advocate tools won&rsquo;t be able to
              keep you signed in without the authentication cookies.
            </li>
            <li>
              <strong>Local storage.</strong> You can clear your browser&rsquo;s
              local storage at any time to reset your theme and tour
              preferences.
            </li>
            <li>
              <strong>Your account and data.</strong> To access, correct, or
              delete your account and saved conversations, contact us using the
              details below.
            </li>
          </ul>

          <h2>Changes to this policy</h2>
          <p>
            We may update this policy as the site evolves. When we do,
            we&rsquo;ll revise the &ldquo;last updated&rdquo; date at the top of
            this page.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about your privacy or this policy? Email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
      </Container>
    </section>
  );
}
