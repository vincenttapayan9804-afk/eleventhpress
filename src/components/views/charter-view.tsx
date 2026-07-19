"use client";

import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck,
  Crown,
  ClipboardCheck,
  Users2,
  BookOpenCheck,
  EyeOff,
  MessageSquareWarning,
  Scale,
  BrainCircuit,
  Handshake,
  Award,
  Sparkles,
  FileCheck2,
  ListChecks,
  Quote,
  Mail,
} from "lucide-react";

/**
 * The Experts' Insights vertical's Publication Charter — three parts,
 * per the vetting/quality framework the Council operates under:
 * the Publication Governance Standard, the Code of Conduct, and the Seal
 * of Quality. Mirrors policies-view.tsx's section+Card+Item template.
 * The Seal is a real, board-issued credential (a Certificate of
 * Membership under category EXPERT — see src/lib/certificates-server.ts),
 * never a self-claimed badge; this page states that plainly rather than
 * implying an external accreditation, matching this platform's existing
 * honesty convention on the Policies page.
 */
export function CharterView() {
  const { setView, openDashboard, user } = useApp();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Publication Charter</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground text-justify">
          The standards the Council of Experts operates under — how insights are selected and
          managed, the conduct expected of every member, and what the Seal of Quality actually
          represents.
        </p>
      </div>

      {/* Publication Governance Standard */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">The Publication Governance Standard</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          How an Expert Insight moves from submission to publication — the same editorial
          infrastructure that governs peer-reviewed research on this platform, applied to
          thought-leadership content.
        </p>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PolicyItem
                icon={Users2}
                title="Content & publication selection"
                desc="Every Insight is submitted by a vetted Council member and enters the same editorial queue as peer-reviewed research — an editor reviews it for relevance and alignment before it advances."
              />
              <PolicyItem
                icon={ListChecks}
                title="Management"
                desc="Insights are tracked through the same DRAFT → SUBMITTED → ACCEPTED → PUBLISHED pipeline as research articles, with a full audit trail of every editorial decision."
              />
              <PolicyItem
                icon={BookOpenCheck}
                title="Editorial & publication style guide"
                desc="Enterprise-Grade Formatting is enforced at submission: standardized headers, a mandatory 5-bullet Key Takeaways box, and structured citations — see the Enterprise-Grade Formatting section below."
              />
              <PolicyItem
                icon={EyeOff}
                title="Double-blind / internal review"
                desc="Council members choose the same review-model options as research authors (double-blind by default), applied by the editorial board before an Insight is accepted."
              />
              <PolicyItem
                icon={ShieldCheck}
                title="Quality assurance disclaimer"
                desc={'Every published Expert Insight carries this footer: "This article was board-reviewed by the Council of Experts for industry relevance and professional alignment." — a factual statement of what happened, not a claim of independent fact-checking.'}
              />
              <PolicyItem
                icon={FileCheck2}
                title="Structured citations"
                desc="Even opinion pieces must cite at least one data source or peer-reviewed reference — enforced at submission, not left to the author's discretion."
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Enterprise-Grade Formatting */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Enterprise-Grade Formatting</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          Every Expert Insight is required to meet the same structural bar, regardless of topic —
          built for how enterprise and professional readers actually scan long-form content.
        </p>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PolicyItem
                icon={ListChecks}
                title="Standardized headers"
                desc="Title, Insight Category, Council tier, and author byline appear in the same position on every published Insight."
              />
              <PolicyItem
                icon={Quote}
                title="The Key Takeaways box"
                desc="Every article opens with exactly 5 bulleted Executive Insights, enforced at submission — validated server-side, not left as a suggestion."
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Code of Conduct */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">The Code of Conduct</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          What the Council expects of every member — Contributor or Council Member alike — in
          how they write and engage.
        </p>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PolicyItem
                icon={BrainCircuit}
                title="Intellectual rigor"
                desc="Claims must be supportable — by data, by cited precedent, or by clearly-attributed professional experience. Vague assertion is not analysis."
              />
              <PolicyItem
                icon={Scale}
                title="Objectivity"
                desc="Members disclose material conflicts of interest with the subject of their Insight, the same standard applied to peer reviewers on this platform."
              />
              <PolicyItem
                icon={MessageSquareWarning}
                title="Expert peer-level discourse"
                desc="Disagreement is expected and welcome; it is conducted on the merits, addressed to the argument, and free of personal attack — the same conduct expected of editorial-board discourse."
              />
              <PolicyItem
                icon={ShieldCheck}
                title="Enforcement"
                desc="A substantiated conduct violation is reviewed by the editorial board and can result in suspension or removal from the Council, independent of any individual article's status."
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Seal of Quality */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">The Seal of Quality</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          A real, individually-issued credential — not a badge anyone can claim. It is granted
          automatically the moment a Prestige Application is approved by the editorial board,
          and downloadable as a serial-numbered, hash-verifiable PDF from the Certificates tab of
          your dashboard.
        </p>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PolicyItem
                icon={ClipboardCheck}
                title="Excellence standard"
                desc="Issued only after the Prestige Application's vetting process — proof of license or certification, 3-5+ years of professional experience, and a reviewed application statement."
              />
              <PolicyItem
                icon={Crown}
                title="Elite status symbol"
                desc="Displayed on the Council of Experts' Directory and on the holder's public profile as a Council Member or Contributor credential, alongside real insight/view/follower counts — never a fabricated metric."
              />
            </div>
            <Separator className="my-4" />
            <div className="flex flex-wrap items-start gap-4 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                The Seal of Quality reflects this platform&apos;s own internal vetting and editorial
                standards — it is not a claim of formal external accreditation, licensure, or
                certification by any bar association, medical board, or professional
                regulatory body, none of which this platform holds or issues on their behalf.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <p className="eyebrow">Join the Council</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          Apply for the Prestige Application
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Lawyers, physicians, neuroscientists, business leaders, educators, psychologists,
          accountants, and other elite industry professionals may apply as a Contributor
          (one-off pieces) or a Council Member (recurring monthly insights).
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button onClick={() => (user ? openDashboard("application") : setView("login"))}>
            <Crown className="mr-2 h-4 w-4" /> Apply to the Council
          </Button>
          <Button variant="outline" onClick={() => setView("experts")}>
            <Users2 className="mr-2 h-4 w-4" /> Council of Experts' Directory
          </Button>
          <Button variant="outline" asChild>
            <a href="mailto:editorial@eleventhpress.org?subject=Council%20of%20Experts%20inquiry">
              <Mail className="mr-2 h-4 w-4" /> Email the editorial office
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}

function PolicyItem({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
