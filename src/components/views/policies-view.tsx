"use client";

import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DOI_REGISTRAR } from "@/lib/site";
import {
  ShieldCheck,
  Scale,
  Globe2,
  Users,
  Search,
  AlertTriangle,
  Mail,
  Lightbulb,
  Eye,
  Compass,
  ClipboardCheck,
  EyeOff,
  Fingerprint,
  UserCheck,
  Ban,
  HandCoins,
  Cpu,
  Microscope,
  Quote,
  FileText,
  BookOpen,
} from "lucide-react";

/**
 * Consolidates the COPE/SCOPUS/WoS-aligned policy content that already
 * exists (and remains the source of record) on the About page's
 * "Publication ethics" and "Peer-review process" sections, plus the
 * Resources → Guides ethics documents — presented here as a single,
 * dedicated reference page rather than duplicated free text. This page
 * describes what the platform actually does; it is not a claim of formal
 * COPE membership or Scopus/WoS certification, which are external,
 * application-based statuses this platform does not hold.
 */
export function PoliciesView() {
  const { setView } = useApp();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Policies</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground text-justify">
          How our editorial, authorship, and indexing practices are benchmarked against the
          standards used by the field&apos;s major ethics and citation-indexing bodies. This is a
          description of what the platform actually enforces at each stage — not a claim of
          formal COPE membership or Scopus/Web of Science certification, which are separate,
          externally-granted statuses.
        </p>
      </div>

      {/* COPE */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">COPE-compliant policies</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          We follow the Committee on Publication Ethics (COPE) and ICMJE conventions for
          editorial and publishing malpractice — authorship, misconduct, conflicts of interest,
          and how a concern gets reported and resolved.
        </p>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PolicyItem
                icon={Users}
                title="Authorship"
                desc="Everyone listed as an author must have made a genuine intellectual contribution. Disputes are resolved by the handling editor before publication, not after."
              />
              <PolicyItem
                icon={Search}
                title="Plagiarism & data integrity"
                desc="Every submission runs through an automated in-corpus similarity check before review, and citations are validated against OpenAlex during production to catch unresolvable or fabricated references."
              />
              <PolicyItem
                icon={Scale}
                title="Conflicts of interest"
                desc="Reviewers and editors must disclose any competing interest with a submission's authors or subject matter, and recuse themselves from handling it where one exists."
              />
              <PolicyItem
                icon={AlertTriangle}
                title="Corrections & retractions"
                desc="Post-publication integrity issues are handled per COPE/ICMJE convention — Corrigendum, Erratum, Expression of Concern, or Retraction — and published as a permanent, linked addendum."
              />
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <a href="mailto:editorial@eleventhpress.org?subject=Research%20integrity%20concern">
                  <Mail className="mr-2 h-3.5 w-3.5" /> Report a concern
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SCOPUS */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Fingerprint className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">SCOPUS-compliant policies</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          Before review, every manuscript is screened for strict adherence to the Scopus
          (Elsevier) Content Selection &amp; Advisory Board (CSAB) standards for authors. Failure
          to meet these ethical requirements results in immediate rejection, independent of
          scientific merit.
        </p>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PolicyItem
                icon={Fingerprint}
                title="Reporting & originality"
                desc="Authors must guarantee original research. Plagiarism is strictly prohibited; use of private data or conversations requires written permission."
              />
              <PolicyItem
                icon={UserCheck}
                title="Authorship criteria"
                desc="Authorship is limited to those who made significant contributions. All listed authors must approve the final version."
              />
              <PolicyItem
                icon={Ban}
                title="Concurrent publication"
                desc="Submission to multiple journals at once is prohibited. Secondary publications (e.g. translations) require explicit agreement from all parties."
              />
              <PolicyItem
                icon={HandCoins}
                title="Conflict of interest & transparency"
                desc="Authors must transparently disclose all financial, personal, or sponsor-related competing interests."
              />
              <PolicyItem
                icon={Cpu}
                title="Generative AI disclosure"
                desc="Authors must follow the press's AI disclosure policy for any use of generative AI in writing, data, or image generation."
              />
              <PolicyItem
                icon={Globe2}
                title="Data access & jurisdictional neutrality"
                desc="Authors must be prepared to share research data on request. Maps and affiliations must remain neutral on territorial or national disputes."
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* WoS */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Microscope className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Web of Science (WoS)-compliant policies</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          Every submission is benchmarked against the Web of Science Core Collection editorial
          selection criteria — structural readiness, review-model transparency, and scientific
          rigor — before and during formal peer review.
        </p>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PolicyItem
                icon={Lightbulb}
                title="Academic contribution"
                desc="The work must offer a distinct contribution to the field."
              />
              <PolicyItem
                icon={Eye}
                title="Clarity & readability"
                desc="Abstracts must be clear and concise; the manuscript must demonstrate high readability and conform to English-language standards."
              />
              <PolicyItem
                icon={Compass}
                title="Scope conformity"
                desc="The manuscript must align strictly with the journal's stated Aims & Scope."
              />
              <PolicyItem
                icon={ClipboardCheck}
                title="Foundational requirements"
                desc="Verification of ISSN, publisher identification, active contact details, and a published peer-review policy."
              />
              <PolicyItem
                icon={EyeOff}
                title="Review model disclosure"
                desc="The review model applied — double-blind by default, with single-blind or open review used where disciplinary norms call for it — must be disclosed and consistently applied."
              />
              <PolicyItem
                icon={Quote}
                title="Scientific & technical rigor"
                desc="Discipline-matched reviewers formally evaluate methodological validity against the highest technical standards before a decision is issued."
              />
            </div>
            <Separator className="my-4" />
            <div className="flex flex-wrap items-start gap-4 text-xs text-muted-foreground">
              <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Metadata for every published article is exposed as Dublin Core records through
                our OAI-PMH 2.0 endpoint — the standard harvesting format Scopus and WoS
                harvesters, and journal-indexing crawlers generally, consume to pull structured
                metadata. Every article also carries a real, permanently-resolving{" "}
                {DOI_REGISTRAR} DOI.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <p className="eyebrow">Full detail</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          See the complete editorial protocol and ethics statement
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          These policies are excerpted from the full Publication Ethics statement and the
          three-phase Peer-Review Protocol on the About page, and the Corrections/Retractions
          guide under Resources.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button onClick={() => setView("about")}>
            <BookOpen className="mr-2 h-4 w-4" /> About the journal
          </Button>
          <Button variant="outline" onClick={() => setView("resources")}>
            <FileText className="mr-2 h-4 w-4" /> Resources & guides
          </Button>
          <Button variant="outline" asChild>
            <a href="mailto:editorial@eleventhpress.org">
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
