"use client";

import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Scale, CreditCard, ShieldAlert, Ban, Mail } from "lucide-react";
import { APC_USD, SUBSCRIPTION_PLAN_PRICES } from "@/lib/pricing";

/**
 * The account/platform-usage contract — distinct from PoliciesView's
 * editorial-ethics standards (authorship, plagiarism, COPE/Scopus/WoS
 * compliance) and from PrivacyView's data-rights disclosures. First-pass
 * terms grounded in what this platform actually does (real payment
 * gateways, real CC BY licensing, real self-service account deletion) —
 * same honesty convention as the rest of the governance pages — not
 * boilerplate. Recommend real legal counsel review before this is treated
 * as a final, binding contract at scale.
 */
export function TermsView() {
  const { setView, user, openDashboard } = useApp();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Terms of Service</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground text-justify">
          The rules for using an Eleventh Press account and this platform. For how manuscripts are
          reviewed and published, see the Policies page. For what we collect and how to export or
          delete your data, see the Privacy page.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Accounts</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground text-justify">
            <p>
              You must provide accurate registration information and are responsible for activity
              under your account. Keep your password confidential and enable two-factor
              authentication if your role qualifies for it (editorial staff, reviewers with elevated
              access). Reviewer, Editor, and Council/Expert roles go through an application and
              approval step before they take effect — you cannot self-assign a privileged role.
            </p>
            <p>
              Accounts are for individual use. Institutional access (IP/domain-based, unlimited
              concurrent users under a subscribing institution) is granted to an organization, not
              shared personal logins.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Acceptable use</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground text-justify">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Submit plagiarized, fabricated, or previously-published-elsewhere work as an original manuscript, or misrepresent authorship, affiliation, or conflicts of interest.</li>
              <li>Attempt to bypass rate limits, upload malicious files, probe for or exploit vulnerabilities, or access another user's account or unpublished submissions without authorization.</li>
              <li>Scrape or bulk-harvest the platform outside the documented, intentionally public interfaces (OAI-PMH, the REST API, ReDIF) provided for that purpose.</li>
              <li>Use the Council of Experts, "Ask an Expert," or any comment/insight surface to post unlawful, harassing, or deliberately false content.</li>
            </ul>
            <p>
              Manuscript integrity issues (plagiarism, data fabrication, undisclosed AI-generated
              content, authorship disputes) are handled under the Policies page's COPE-aligned
              process, which can result in rejection, correction, or retraction of already-published
              work.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Content & licensing</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground text-justify">
            <p>
              You retain copyright in your own submitted work. Published articles are distributed
              under CC BY 4.0 (or as otherwise noted on the article itself) — this is a license you
              grant to the public, not a transfer of ownership to Eleventh Press. Once a DOI is
              minted and an article is published, its citable record (title, authors, abstract,
              content) is retained permanently as the scholarly record, consistent with standard
              publishing practice and GDPR's archiving exemption (see the Privacy page).
            </p>
            <p>
              The Eleventh Press name, logo, and site design are not covered by the CC BY license
              articles are published under, and may not be used to imply endorsement without
              permission.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Subscriptions & payments</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground text-justify">
            <p>
              Article Processing Charges (currently ${APC_USD.toFixed(2)}, waivable in cases of
              documented financial hardship or covered by a subscribing institution's agreement) are
              billed once a manuscript is accepted and cover peer review, production, DOI
              registration, and indexing — publishing itself is never conditioned on ability to pay.
              APCs are non-refundable once production of the accepted manuscript has begun.
            </p>
            <p>
              Reader subscriptions (currently ${SUBSCRIPTION_PLAN_PRICES.READER_MONTHLY.toFixed(2)}/mo
              or ${SUBSCRIPTION_PLAN_PRICES.READER_YEARLY.toFixed(2)}/yr) and Institutional
              subscriptions (${SUBSCRIPTION_PLAN_PRICES.INSTITUTIONAL.toFixed(2)}/yr) are convenience
              tiers — every article is already free to read as open access regardless of
              subscription status. Subscriptions may be cancelled at any time, effective at the end
              of the current billing period; we do not provide partial-period refunds. Payment card
              details are handled entirely by your chosen payment gateway's hosted checkout and never
              stored on our servers.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Disclaimers & liability</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground text-justify">
            <p>
              The platform is provided "as is." Peer review reduces but does not eliminate errors in
              published work — published articles reflect their authors' views, not an endorsement by
              Eleventh Press of every claim made in them. To the maximum extent permitted by law,
              Eleventh Press is not liable for indirect, incidental, or consequential damages arising
              from use of the platform or reliance on published content.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Ban className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Termination</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground text-justify">
            <p>
              You may delete your account at any time from the Profile tab — see the Privacy page for
              exactly what that does. We may suspend or terminate an account for violating the
              acceptable-use terms above, without affecting the permanence of any already-published,
              DOI-bearing work under it (its citable record and CC BY license are not retroactively
              revoked).
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Governing law & changes</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground text-justify">
            <p>
              These terms are governed by the laws of England and Wales, matching our editorial
              office's jurisdiction (London, United Kingdom), without regard to conflict-of-law
              principles. We may update these terms from time to time; material changes will be
              reflected in the "Last updated" date above.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <p className="eyebrow">Questions</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">Need clarification on these terms?</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button onClick={() => (user ? openDashboard("profile") : setView("login"))}>Manage my account</Button>
          <Button variant="outline" asChild>
            <a href="mailto:editorial@eleventhpress.org?subject=Terms%20of%20Service%20question">
              <Mail className="mr-2 h-4 w-4" /> Email us
            </a>
          </Button>
          <Button variant="outline" onClick={() => setView("privacy")}>
            View privacy &amp; data rights
          </Button>
        </div>
      </section>
    </div>
  );
}
