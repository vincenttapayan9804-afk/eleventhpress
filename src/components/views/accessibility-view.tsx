"use client";

import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accessibility, Eye, Keyboard, Sparkles, Mail } from "lucide-react";

/**
 * Describes what's actually been verified and what's automated, matching
 * the same honesty convention as PoliciesView/PrivacyView: a real account
 * of current posture, not a claim of WCAG/ATAG certification (there is no
 * such external certification body to claim membership of, unlike the
 * COPE/Scopus/WoS distinctions PoliciesView draws — WCAG 2.2 is a
 * standard to conform to, not an org to join).
 */
export function AccessibilityView() {
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
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Automated & AI-assisted</h2>
        </div>
        <Card className="paper-card mt-4">
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground text-justify">
              An axe-core accessibility scan runs in CI on every change, scoped for now to the pages
              that render without a database (most of this app has no distinct URL per page — it's a
              single-page app switching views under one address). It's currently informational rather
              than merge-blocking: axe-core has a documented limitation resolving contrast on
              gradient and glassmorphic backgrounds (it compares against the wrong composited color),
              which needs a human visual check to tell apart from a real issue — the same reason a
              rendered-page audit, not just a static one, matters.
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

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <Accessibility className="mx-auto h-6 w-6 text-primary" />
        <h2 className="mt-3 font-display text-2xl font-semibold">Found an accessibility barrier?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Tell us what you ran into and we'll look into it.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="outline" asChild>
            <a href="mailto:editorial@eleventhpress.org?subject=Accessibility%20issue">
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
