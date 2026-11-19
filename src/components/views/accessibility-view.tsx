"use client";

import { useContactEmail } from "@/lib/tenant-branding-context";
import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ACR_REVIEWED,
  WCAG22_CONFORMANCE,
  conformanceSummary,
  type ConformanceLevel,
} from "@/lib/accessibility-conformance";
import {
  Accessibility,
  ClipboardList,
  Eye,
  Keyboard,
  Mail,
  ScanSearch,
} from "lucide-react";

/**
 * Describes what's actually been verified and what's automated, matching
 * the same honesty convention as PoliciesView/PrivacyView: a real account
 * of current posture, not a claim of WCAG/ATAG certification (there is no
 * such external certification body to claim membership of, unlike the
 * COPE/Scopus/WoS distinctions PoliciesView draws — WCAG 2.2 is a
 * standard to conform to, not an org to join).
 */
export function AccessibilityView() {
  const contactEmail = useContactEmail();
  const { setView } = useApp();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Accessibility</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground text-justify">
          We target WCAG 2.2 Level AA. This page describes what's actually been verified and
          automated, not a claim of formal certification — there is no external body that certifies
          WCAG conformance the way COPE membership or Scopus indexing works.
        </p>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Verified</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <PolicyItem
              title="Color contrast"
              desc="Core text/background token pairs were computed directly (OKLCH → sRGB): 18.4:1 body text, 5.4:1–7.4:1 muted text, 10.7:1–7.6:1 primary — all pass AA's 4.5:1 minimum, in both light and dark theme."
            />
            <PolicyItem
              title="Keyboard navigation"
              desc="A skip-to-content link, a visible focus ring on every interactive element, and every click-to-navigate control (including card-style links) also responds to Enter/Space."
            />
            <PolicyItem
              title="Labeled form fields"
              desc="Every input on the submission form — including the repeating author and funder blocks — has a programmatically associated label, not just placeholder text."
            />
            <PolicyItem
              title="Landmarks & document structure"
              desc="Real <header>/<nav>/<main> landmarks and a declared page language, so assistive technology can navigate by region."
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <ScanSearch className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Automated & AI-assisted</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground text-justify">
              An axe-core scan against the WCAG 2.0, 2.1 and 2.2 A/AA rules runs on every change and blocks a release
              when it finds a violation. It covers the pages that render without signing in; the article reader and
              dashboards are checked by hand. The one region it skips is the home page hero, where axe-core cannot
              measure contrast against a gradient — that was verified visually instead.
            </p>
            <p className="text-sm text-muted-foreground text-justify">
              E-books carry EPUB Accessibility 1.1 metadata describing their features, and only claim WCAG
              conformance when every image has a text alternative. The page language follows the interface language
              you choose, so screen readers use the right voice.
            </p>
            <p className="text-sm text-muted-foreground text-justify">
              AI-generated alt-text suggestions are produced automatically for every figure when an
              article publishes, but never applied automatically — an editor reviews and approves
              each one before it reaches the published galley.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Keyboard className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Known gaps</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-justify">
              There is no authoring tool that structures a manuscript's headings, alt-text, or
              semantic markup at submission time — submissions go through a plain text field, so
              accessibility of a published article's HTML depends on what the underlying conversion
              produces. Automated CI scanning only covers database-free pages today, not the full
              article-reading experience.
            </p>
          </CardContent>
        </Card>
      </section>

      <AcrSection />

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <Accessibility className="mx-auto h-6 w-6 text-primary" />
        <h2 className="mt-3 font-display text-2xl font-semibold">Found an accessibility barrier?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Tell us what you ran into and we'll look into it.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="outline" asChild>
            <a href={`mailto:${contactEmail}?subject=Accessibility%20issue`}>
              <Mail className="mr-2 h-4 w-4" /> Report an issue
            </a>
          </Button>
          <Button variant="outline" onClick={() => setView("policies")}>
            View policies
          </Button>
        </div>
      </section>
    </div>
  );
}

function PolicyItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

const LEVEL_CLASS: Record<ConformanceLevel, string> = {
  Supports: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Partially supports": "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Does not support": "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  "Not applicable": "border-border text-muted-foreground",
};

/**
 * Accessibility Conformance Report (VPAT 2.5 INT format) — data in
 * src/lib/accessibility-conformance.ts.
 */
function AcrSection() {
  const summary = conformanceSummary();
  return (
    <section className="mt-10" id="conformance-report" aria-labelledby="acr-title">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="acr-title" className="font-display text-2xl font-semibold">Accessibility Conformance Report</h2>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
        Prepared in the format of the ITI VPAT&reg; 2.5 International Edition, which covers WCAG 2.2, US Section 508
        and EU EN 301 549 (whose web requirements are the same WCAG Level A and AA criteria). Self-assessed; last
        reviewed {ACR_REVIEWED}.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(summary) as ConformanceLevel[]).map((k) => (
          <div key={k} className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="font-display text-2xl font-semibold">{summary[k]}</p>
          </div>
        ))}
      </div>
      <Card className="paper-card mt-4">
        <CardContent className="p-0">
          <ul className="divide-y divide-border sm:hidden" aria-label="WCAG 2.2 conformance">
            {WCAG22_CONFORMANCE.map((r) => (
              <li key={r.sc} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">
                    {r.sc} {r.name} <span className="text-xs text-muted-foreground">(Level {r.level})</span>
                  </p>
                  <Badge variant="outline" className={`shrink-0 whitespace-nowrap text-[10px] ${LEVEL_CLASS[r.conformance]}`}>
                    {r.conformance}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.remarks}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block" role="region" aria-label="WCAG 2.2 conformance table" tabIndex={0}>
            <table className="w-full min-w-[640px] text-left text-xs">
              <caption className="sr-only">WCAG 2.2 Level A and AA success criteria, conformance level and remarks</caption>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Criterion</th>
                  <th scope="col" className="p-3 font-semibold">Level</th>
                  <th scope="col" className="p-3 font-semibold">Conformance</th>
                  <th scope="col" className="p-3 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {WCAG22_CONFORMANCE.map((r) => (
                  <tr key={r.sc} className="align-top">
                    <th scope="row" className="p-3 font-medium">
                      {r.sc} {r.name}
                    </th>
                    <td className="p-3">{r.level}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`whitespace-nowrap text-[10px] ${LEVEL_CLASS[r.conformance]}`}>
                        {r.conformance}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
