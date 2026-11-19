"use client";

import { openContact } from "@/lib/contact-store";
import { useLegalIdentity } from "@/lib/tenant-branding-context";
import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { LEGAL_PAGES_UPDATED } from "@/lib/site";
import {
  ShieldCheck,
  Download,
  Trash2,
  Database,
  Clock,
  Mail,
  Cookie,
  Building2,
  Scale,
} from "lucide-react";

/**
 * Describes what the platform actually collects, why, how long it's kept,
 * and the two self-service data-subject rights that are real and wired up
 * (Profile tab → "Your data": export via GET /api/account/export, erasure
 * via POST /api/account/delete). This replaces the footer's former blanket
 * "GDPR / CCPA compliant" badge, which had no real export/delete/consent
 * mechanism behind it — same honesty convention as the Policies page's
 * COPE/Scopus/WoS disclosures: what's implemented, not a claim of external
 * certification.
 */
export function PrivacyView() {
  // On a tenant's site the tenant is the data controller; Eleventh Press
  // (the platform provider) processes data on its behalf.
  const legal = useLegalIdentity();
  const contactEmail = legal.privacyEmail;
  const { setView, user, openDashboard } = useApp();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Privacy &amp; data rights</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground text-justify">
          What we collect, why, how long we keep it, and how to export or erase your own account
          data — self-service, no request form required.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: {LEGAL_PAGES_UPDATED}</p>
      </div>

      <section className="mt-10" data-testid="privacy-controller">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Who is responsible for your data</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground text-justify">
            <p>
              The data controller for this site is <strong className="text-foreground">{legal.legalName}</strong>
              {legal.location ? <>, {legal.location}</> : null}. In this policy, &ldquo;we&rdquo; and &ldquo;our&rdquo; mean{" "}
              {legal.legalName}. For any privacy question or data-rights request, email{" "}
              <a className="text-primary hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </p>
            {legal.whitelabel && (
              <p>
                The publishing platform this site runs on is provided by Eleventh Press International Publishing™,
                which hosts and processes data on {legal.orgName}&apos;s behalf as a processor, under {legal.orgName}&apos;s
                instructions, and does not use it for its own purposes.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">What we collect</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <PrivacyItem
              title="Account profile"
              desc="Name, email, affiliation, ORCID, and any optional bio/social/contact fields you choose to add. Editable any time in your Profile tab."
            />
            <PrivacyItem
              title="Submission & review data"
              desc="Manuscripts, reviews, editorial decisions, and author responses — retained as part of the permanent scholarly and editorial record."
            />
            <PrivacyItem
              title="Payment records"
              desc="Invoice amount, status, and provider reference for APCs/subscriptions. Card numbers are handled entirely by the payment provider — never stored on our servers."
            />
            <PrivacyItem
              title="AI assistant conversations"
              desc="Questions you type into Ask the Corpus and the answers, saved to your account so you can return to them. Delete any conversation at any time; they are erased with your account."
            />
            <PrivacyItem
              title="Security records"
              desc="A sign-in history (time, approximate device and location) and, if you enable them, your passkeys and two-factor settings — used to protect your account and show you where you're signed in."
            />
            <PrivacyItem
              title="Usage events"
              desc="Article views/downloads and, for institutional subscribers, COUNTER 5 usage events — includes IP address at the time of the request, used to attribute usage to a subscribing institution."
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">How long we keep it</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-justify">
              Your account profile is kept until you delete it. Published articles, reviews tied to
              a citable DOI, and financial records are retained indefinitely as the permanent
              scholarly and audit record — this is standard practice at every scholarly publisher,
              and consistent with GDPR Art. 17(3)(d)'s archiving exemption. Raw IP addresses
              recorded against usage events are cleared automatically once they're no longer needed
              to attribute usage to an institution — after 90 days.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Cookie className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Cookies</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground text-justify">
              We set three strictly necessary cookies, which require no consent under data-protection and ePrivacy rules,
              plus one optional cookie that does — covered by the consent banner shown on your first
              visit, and here plainly either way:
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <PrivacyItem
                title="epip_session"
                desc="Your signed login session. HttpOnly (invisible to page JavaScript), sent only to our own server, expires after 7 days or on sign-out. Strictly necessary."
              />
              <PrivacyItem
                title="epip_csrf"
                desc="A random token your browser echoes back on every action that changes data, so a malicious site can't submit forms on your behalf. Not a tracking identifier — it carries no personal data. Strictly necessary."
              />
              <PrivacyItem
                title="cookie_consent"
                desc="Remembers the choice you made in the cookie banner, so we don't ask again every visit. Strictly necessary — its entire purpose is honoring a privacy choice you already made."
              />
              <PrivacyItem
                title="reader_key"
                desc="Optional. A random identifier for an anonymous (not signed-in) reader, used only to apply the free-article limit on magazine content. Set only if you accept it in the cookie banner; signed-in readers are metered via their existing session instead, so this never applies to them. Decline it and anonymous magazine reading stays unmetered — not blocked, just uncounted."
              />
            </div>
            <p className="text-sm text-muted-foreground text-justify">
              We do not run analytics, advertising, or third-party tracking scripts of any kind on
              this platform, so there are no other cookies to disclose. If that ever changes, this
              page — and the consent banner's choices — will change first.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={openCookiePreferences}>
                Manage cookie preferences
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/cookie-policy">Read the full Cookie Policy</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Who we share data with</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-justify">
              We don&apos;t sell data. A limited set of processors handle it on our behalf, only for the
              purpose named: {legal.whitelabel ? "Eleventh Press International Publishing™ (the platform provider, which operates the service below for us), " : ""}our hosting and database provider (running the application and storing
              your account/submission data), our object storage provider (manuscript files, galleys,
              avatars), our email delivery provider (Resend — sends account and notification emails),
              our error-monitoring service (Sentry — receives technical details of a failed request,
              which can include your IP address), our rate-limiting service (Upstash — briefly holds IP
              addresses to block abusive traffic), your chosen payment gateway (Stripe, PayPal, PayMongo, Lemon Squeezy, or
              Xendit — whichever you select at checkout; card details go directly to them, never to
              us), VirusTotal (scans uploaded files for malware — the file only, not your account
              details), AI model providers (OpenRouter and the model hosts it routes to, or Anthropic) —
              which receive submitted manuscript text for editorial triage and the questions you ask
              the AI assistant, without your account details — and Zenodo (mints your article's DOI, which is inherently public
              once published). ORCID and Blogger only ever receive data if you explicitly connect
              those accounts yourself.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Legal basis for processing</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <PrivacyItem
              title="Contract"
              desc="Account profile, submission & review data, and payment records — processing necessary to provide the account or service you asked for."
            />
            <PrivacyItem
              title="Legal obligation"
              desc="Financial/invoice records retained for tax and audit purposes; a permanent citable scholarly record for published, DOI-bearing work."
            />
            <PrivacyItem
              title="Legitimate interest"
              desc="Usage events (views/downloads/COUNTER 5) for institutional reporting, and security logging (login audit trail, rate limiting) to protect accounts from abuse."
            />
            <PrivacyItem
              title="Consent"
              desc="Optional integrations you opt into yourself — connecting ORCID or Blogger, or enabling two-factor authentication."
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Your rights</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-md border border-border p-4">
              <Download className="h-4 w-4 text-primary" />
              <p className="mt-2 font-display text-sm font-semibold">Export your data</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Download a JSON copy of your profile, submissions, reviews, invoices, and
                notifications — anytime, from the Profile tab.
              </p>
            </div>
            <div className="rounded-md border border-border p-4">
              <Trash2 className="h-4 w-4 text-primary" />
              <p className="mt-2 font-display text-sm font-semibold">Delete your account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Anonymizes every personal field on your account immediately — bio, avatar, contact
                info, and any signed reviewer attribution switch to "Deleted User." The citable
                author byline on an already-published, DOI-bearing article is a permanent part of
                that DOI's record and is not retroactively changed.
              </p>
            </div>
          </CardContent>
          <CardContent className="space-y-3 px-6 pb-6 pt-0 text-sm text-muted-foreground text-justify" data-testid="privacy-rights-law">
            <p>
              You also have the right to be informed, to access and correct your data, to object to
              or restrict processing, to data portability, and to claim damages for unlawful
              processing — under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and,
              if you are in the European Union or United Kingdom, the GDPR. Most profile corrections
              can be made yourself in the Profile tab; for anything else, email{" "}
              <a className="text-primary hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>{" "}
              and we will respond within 30 days.
            </p>
            <p>
              If you believe we have mishandled your data, you can complain to{" "}
              {legal.whitelabel ? "the data-protection authority where you live" : (
                <>
                  the{" "}
                  <a className="text-primary hover:underline" href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">
                    National Privacy Commission of the Philippines
                  </a>{" "}
                  or the data-protection authority where you live
                </>
              )}
              . We would appreciate the chance to put it right first.
            </p>
            <p>
              This site is not intended for children under 13, and we do not knowingly collect their
              data. Data is processed on cloud infrastructure that may be outside your country; where
              it is, we rely on our providers&apos; standard contractual safeguards.
            </p>
          </CardContent>
          <CardContent className="flex flex-wrap gap-3 px-6 pb-6 pt-0">
            <Button onClick={() => (user ? openDashboard("profile") : setView("login"))}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Manage my data
            </Button>
            <Button variant="outline" onClick={() => openContact("privacy")} data-testid="cta-contact-privacy">
              <Mail className="mr-2 h-4 w-4" /> Make a data rights request
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <p className="eyebrow">Full detail</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">Editorial &amp; ethics policies</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          For how manuscripts, reviews, and corrections are handled, see the Policies page.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => setView("policies")}>
            View policies
          </Button>
          <Button variant="outline" onClick={() => setView("terms")}>
            View Terms of Service
          </Button>
        </div>
      </section>
    </div>
  );
}

function PrivacyItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
