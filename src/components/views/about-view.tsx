"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DOI_REGISTRAR } from "@/lib/site";
import {
  BookOpen,
  ShieldCheck,
  Globe2,
  Users,
  FileText,
  Quote,
  Scale,
  Microscope,
  Atom,
  Cpu,
  Brain,
  Leaf,
  Calculator,
  Landmark,
  BarChart3,
  Workflow,
  Database,
  Cloud,
  Bell,
  CreditCard,
  Search,
  Share2,
  AlertTriangle,
  Mail,
  Lightbulb,
  Eye,
  Compass,
  ClipboardCheck,
  Fingerprint,
  UserCheck,
  Ban,
  HandCoins,
  Image as ImageIcon,
  HeartPulse,
  FlaskConical,
  Lock,
  RefreshCw,
  EyeOff,
  Sparkles,
} from "lucide-react";

interface BoardCitationMetrics {
  worksCount: number;
  citedByCount: number;
  hIndex: number | null;
  source: "openalex-live" | "openalex-cached";
}

interface BoardMember {
  id: string;
  fullName: string;
  role: string;
  roleLabel: string;
  affiliation: string | null;
  profession: string | null;
  bio: string | null;
  orcid: string | null;
  avatarUrl: string | null;
  citationMetrics: BoardCitationMetrics | null;
}

function initialsOf(name: string) {
  return name
    .replace(/^Dr\.?\s+|^Prof\.?\s+/, "")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AboutView() {
  const { setView } = useApp();
  const t = useTranslations("home");
  const [board, setBoard] = useState<BoardMember[] | null>(null);

  useEffect(() => {
    apiFetch<{ board: BoardMember[] }>("/api/editorial-board")
      .then(({ board }) => setBoard(board))
      .catch(() => setBoard([]));
  }, []);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-border pb-8">
        <p className="eyebrow">About Eleventh Press</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
          Eleventh Press International Publishing
        </h1>
        <p className="mt-3 font-display text-lg text-royal-gradient">
          A Full-Stack Peer Reviewed Press &amp; Multidisciplinary Syndication Network
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          ISSN 2945-1138 · Publisher prefix 10.52011 · Est. 2021 · London, United Kingdom
        </p>
      </div>

      {/* Aims & Scope */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Aims &amp; scope</h2>
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/85 text-justify">
          <p>
            Eleventh Press International Publishing is not just a journal — it's a complete
            publishing operation built around one submission. We handle rigorous peer
            review, real DOI registration, and genuine open-access production the way any
            serious press should; what sets us apart is what happens next. Every published
            article becomes eligible for automatic syndication across our multidisciplinary
            network, and every author gains access to a full book-publishing division for
            compiling their work — or an entirely new manuscript — into a distributed book.
            We deliberately cultivate a multidisciplinary remit: we believe that the most
            consequential contemporary research questions — climate adaptation, algorithmic
            governance, genomic medicine, urban inequality — sit athwart traditional
            disciplinary boundaries, and that a press built for the next decade of
            scholarship should be built for reach as much as rigor.
          </p>
          <p>
            We operate a double-blind peer-review process by default and offer open and
            single-blind tracks where disciplinary norms warrant. All published articles
            are assigned a real, permanently-resolving {DOI_REGISTRAR} DOI upon
            publication, and are freely downloadable with no login wall — genuine open
            access, not open access in name only. The journal’s content is indexed via an
            OAI-PMH 2.0 endpoint that exposes Dublin Core records for harvester consumption
            by Scopus and Web of Science, and is automatically crawled by Google Scholar.
          </p>
          <p>
            We publish on a continuous basis rather than holding accepted work for a
            periodic print issue: an article goes live individually the moment production
            (typesetting, DOI registration) is complete, and is subsequently collated into
            a dated volume/issue record for citation purposes. This keeps time-to-publication
            tied to how quickly a given manuscript clears review and production, not to a
            fixed quarterly or annual schedule.
          </p>
          <p>
            Our editorial workflow is built on an event-driven microservices architecture:
            every state transition — from initial submission through peer review, APC
            invoicing, production, indexing, and syndication — emits an event that
            downstream services consume asynchronously. This decoupling allows us to scale
            reviewer assignment, plagiarism checking, PDF generation, and cross-platform
            syndication independently.
          </p>
        </div>
      </section>

      {/* What full-stack means */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">What "full-stack" actually means</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          Most journals stop at the DOI. We built the rest of the pipeline authors actually
          need to be read.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Card className="paper-card">
            <CardContent className="p-5">
              <Share2 className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-base font-semibold">Multidisciplinary syndication network</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Once published, your article is eligible for real, one-click syndication:
                genuine API auto-publish to Blogger, ready-to-post kits for ResearchGate,
                Academia.edu, Substack, Medium, LinkedIn, and HubPages, and formatted
                preprint packages for arXiv and SSRN — all generated from the manuscript you
                already submitted.
              </p>
            </CardContent>
          </Card>
          <Card className="paper-card">
            <CardContent className="p-5">
              <BookOpen className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-base font-semibold">Book-publishing division</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Compile your published articles into an edited volume or anthology, or
                submit a standalone monograph — we generate a real EPUB and print-ready PDF
                and distribute it wide through Draft2Digital and IngramSpark, reaching
                Amazon KDP, Apple Books, Barnes &amp; Noble, Kobo, and more.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Disciplines */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Disciplines covered</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { name: "Physics", icon: Atom },
            { name: "Biology", icon: Microscope },
            { name: "Computer Science", icon: Cpu },
            { name: "Sociology", icon: Users },
            { name: "Economics", icon: BarChart3 },
            { name: "Psychology", icon: Brain },
            { name: "Environmental Science", icon: Leaf },
            { name: "Mathematics", icon: Calculator },
          ].map((d) => (
            <Card key={d.name} className="paper-card">
              <CardContent className="flex items-center gap-3 p-4">
                <d.icon className="h-5 w-5 text-primary" />
                <span className="font-sans text-sm font-medium">{d.name}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Peer Review Process */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Peer-review process</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          Our Official Peer Review &amp; Editorial Protocol benchmarks every submission
          against the same quality, ethics, and impact criteria used for international
          citation-indexing review — the Web of Science Core Collection editorial
          selection criteria and the Scopus Content Selection &amp; Advisory Board (CSAB)
          standards for authors and content. Every manuscript is evaluated against the
          specific metrics required for inclusion in premier international databases.
        </p>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/85 text-justify">
          <p>
            Every submission is initially screened by an associate editor for scope fit,
            methodological soundness, and an in-corpus similarity check against every
            other article already in the journal. Submissions that
            pass initial screening are anonymised — for double-blind review, the
            Manuscript Service strips author names, affiliations, and PDF metadata
            automatically using a headless browser — and assigned to two or three
            discipline-matched reviewers.
          </p>
          <p>
            Reviewers are selected from a curated pool indexed by Elasticsearch. Editor
            queries combine the article’s discipline and extracted keywords against
            reviewer expertise statements, and ranked by match score. Reviewers are
            invited with a 14-day deadline; they may accept, decline, or request an
            extension. Completed reviews consist of an overall score (1–5), a
            recommendation (Accept / Minor revisions / Major revisions / Reject), a
            confidence score, and separate comment fields for the author and the editor.
          </p>
        </div>

        {/* Phase I */}
        <Card className="paper-card mt-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <p className="font-display text-base font-semibold">Phase I — Initial triage</p>
              <Badge variant="outline" className="ml-auto text-[0.6rem]">Administrative gatekeeping</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifies structural readiness and foundational quality before a manuscript
              is assigned for review.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Benchmark: Web of Science initial triage &amp; Scopus CSAB content criteria.
            </p>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <IndexItem
                icon={Lightbulb}
                title="Academic contribution"
                desc="The work must offer a distinct contribution to the field."
              />
              <IndexItem
                icon={Eye}
                title="Clarity & readability"
                desc="Abstracts must be clear and concise; the manuscript must demonstrate high readability and conform to English-language standards."
              />
              <IndexItem
                icon={Compass}
                title="Scope conformity"
                desc="The manuscript must align strictly with the journal's stated Aims & Scope."
              />
              <IndexItem
                icon={ClipboardCheck}
                title="Foundational requirements"
                desc="Verification of ISSN, publisher identification, active contact details, and a published peer-review policy."
              />
              <IndexItem
                icon={EyeOff}
                title="Review model disclosure"
                desc="The review model applied — double-blind by default, with single-blind or open review used where disciplinary norms call for it — must be disclosed and consistently applied."
              />
            </div>
          </CardContent>
        </Card>

        {/* Phase II */}
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <p className="font-display text-base font-semibold">Phase II — Editorial triage</p>
              <Badge variant="outline" className="ml-auto text-[0.6rem]">Author & ethical compliance</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Before review, every manuscript is screened for strict adherence to Scopus
              author standards. Failure to meet these ethical requirements results in
              immediate rejection.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Benchmark: Scopus (Elsevier) standards for authors.
            </p>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <IndexItem
                icon={Fingerprint}
                title="Reporting & originality"
                desc="Authors must guarantee original research. Plagiarism is strictly prohibited; use of private data or conversations requires written permission."
              />
              <IndexItem
                icon={UserCheck}
                title="Authorship criteria"
                desc="Authorship is limited to those who made significant contributions. All listed authors must approve the final version."
              />
              <IndexItem
                icon={Ban}
                title="Concurrent publication"
                desc="Submission to multiple journals at once is prohibited. Secondary publications (e.g. translations) require explicit agreement from all parties."
              />
              <IndexItem
                icon={HandCoins}
                title="Conflict of interest & transparency"
                desc="Authors must transparently disclose all financial, personal, or sponsor-related competing interests."
              />
              <IndexItem
                icon={Cpu}
                title="Generative AI"
                desc="Authors must follow the press's AI disclosure policy for any use of generative AI in writing, data, or image generation."
              />
              <IndexItem
                icon={Globe2}
                title="Data access & jurisdictional neutrality"
                desc="Authors must be prepared to share research data on request. Maps and affiliations must remain neutral on territorial or national disputes."
              />
            </div>
          </CardContent>
        </Card>

        {/* Phase III */}
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Microscope className="h-5 w-5 text-primary" />
              <p className="font-display text-base font-semibold">Phase III — Editorial evaluation</p>
              <Badge variant="outline" className="ml-auto text-[0.6rem]">Scientific & technical rigor</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Manuscripts that clear Phase II proceed to formal peer review, where
              discipline-matched experts evaluate methodological validity against the
              highest technical standards.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Benchmark: Web of Science editorial evaluation &amp; Scopus technical standards.
            </p>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <IndexItem
                icon={Quote}
                title="Citation practices"
                desc="Citations must be relevant and peer-reviewed. Excessive self-citation or coercive citation requests are prohibited."
              />
              <IndexItem
                icon={ImageIcon}
                title="Image & data integrity"
                desc="Enhancing, obscuring, or manipulating features within images is forbidden; only minor, non-data-altering adjustments are permitted."
              />
              <IndexItem
                icon={HeartPulse}
                title="Hazards & ethical subjects"
                desc="Unusual hazards must be stated. Research involving human or animal subjects must adhere to strict ethical policies."
              />
              <IndexItem
                icon={FlaskConical}
                title="Clinical trials"
                desc="Authors reporting on clinical trials must follow industry best practices such as the CONSORT guidelines."
              />
              <IndexItem
                icon={Lock}
                title="Confidentiality"
                desc="Information gained during peer review or grant-application services must never be used for a reviewer's own research."
              />
              <IndexItem
                icon={RefreshCw}
                title="Post-publication duty"
                desc="Authors are ethically obligated to notify the editor of a significant error and cooperate fully with any correction or retraction."
              />
              <IndexItem
                icon={Sparkles}
                title="AI-assisted integrity screening"
                desc="Plagiarism screening, statistical sanity checks, and citation validation run alongside human review — built to catch what a manual read misses, never to replace the reviewer's judgment."
              />
            </div>
          </CardContent>
        </Card>

        {/* Decision matrix */}
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <p className="font-display text-base font-semibold">Decision matrix &amp; enforcement</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Outcomes are enforced consistently with international indexing embargo and
              re-evaluation benchmarks.
            </p>
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Evaluation phase</TableHead>
                    <TableHead>Consequence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Badge className="text-[0.65rem]">Pass</Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">Clears Phases I, II, and III</TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">
                      Proceeds to production; eligible for ESCI/SCIE/SSCI indexing assessment.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge variant="outline" className="text-[0.65rem]">Failed triage</Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">Fails Phase I or II</TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">
                      Administrative rejection; resubmission permitted once structural or
                      ethical issues are resolved.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge variant="secondary" className="text-[0.65rem]">Failed quality</Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">Fails Phase III (quality)</TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">
                      Mandatory two-year embargo on resubmission to allow for significant
                      revision.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge variant="destructive" className="text-[0.65rem]">Failed impact</Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">Fails Phase III (impact)</TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">
                      Acceptance denied; citation activity monitored, subject to performance
                      re-evaluation.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-sm leading-relaxed text-foreground/85 text-justify">
          The state machine governing an article’s lifecycle reflects this protocol:
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">DRAFT → SUBMITTED → UNDER_REVIEW → REVISIONS_REQUIRED → ACCEPTED → IN_PRODUCTION → PUBLISHED</code>.
          Editors may also REJECT or WITHDRAW an article at any point.
        </p>

        <Card className="paper-card mt-4 border-dashed">
          <CardContent className="p-5">
            <p className="text-sm leading-relaxed text-foreground/85 text-justify">
              <strong>Certification of compliance.</strong> As a Full-Stack Peer Reviewed
              Press, Eleventh Press International Publishing requires every author and
              reviewer to certify adherence to this protocol. Any attempt to bypass these
              stages through unauthorized means results in immediate rejection.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Editorial Board */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Editorial board</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-justify">
          The accounts with real editorial authority in the platform — the same set that
          can screen, assign reviewers to, and make publication decisions on a submission —
          not a separate, hand-maintained list that could drift out of sync with who
          actually holds editorial authority.
        </p>

        {board === null && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="paper-card animate-pulse">
                <CardContent className="p-5">
                  <div className="h-11 w-11 rounded-full bg-muted" />
                  <div className="mt-3 h-3 w-2/3 rounded bg-muted" />
                  <div className="mt-2 h-2.5 w-1/2 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {board !== null && board.length === 0 && (
          <Card className="paper-card mt-5">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Editorial board listings are being finalized as editorial accounts are added.
              Contact <a href="mailto:editorial@eleventhpress.org" className="text-primary underline underline-offset-2">editorial@eleventhpress.org</a> for the current handling editor on any submission.
            </CardContent>
          </Card>
        )}

        {board !== null && board.length > 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {board.map((m) => (
              <Card key={m.id} className="paper-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 border border-[oklch(0.76_0.11_294/0.3)]">
                      {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.fullName} className="object-cover" />}
                      <AvatarFallback className="bg-[oklch(0.93_0.04_290)] text-sm font-medium text-[oklch(0.42_0.18_295)]">
                        {initialsOf(m.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold">{m.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.profession || m.roleLabel}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="mt-3 text-[0.6rem]">{m.roleLabel}</Badge>
                  {m.affiliation && <p className="mt-2 text-xs text-muted-foreground">{m.affiliation}</p>}
                  {m.orcid && (
                    <a
                      href={`https://orcid.org/${m.orcid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-primary underline underline-offset-2"
                    >
                      ORCID {m.orcid}
                    </a>
                  )}
                  {m.citationMetrics && (
                    <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-md border border-border bg-muted/30 p-2 text-center">
                      <div>
                        <p className="font-mono text-xs font-semibold">{m.citationMetrics.worksCount}</p>
                        <p className="text-[0.55rem] uppercase tracking-wide text-muted-foreground">Works</p>
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold">{m.citationMetrics.citedByCount}</p>
                        <p className="text-[0.55rem] uppercase tracking-wide text-muted-foreground">Citations</p>
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold">{m.citationMetrics.hIndex ?? "—"}</p>
                        <p className="text-[0.55rem] uppercase tracking-wide text-muted-foreground">h-index</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Publication Ethics & Research Integrity */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Publication ethics &amp; research integrity</h2>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <p className="text-sm leading-relaxed text-foreground/85 text-justify">
              We follow COPE (Committee on Publication Ethics) and ICMJE conventions for
              editorial and publishing malpractice. This statement covers authorship,
              misconduct, conflicts of interest, and how to report a concern.
            </p>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <IndexItem
                icon={Users}
                title="Authorship"
                desc="Everyone listed as an author must have made a genuine intellectual contribution. Disputes are resolved by the handling editor before publication, not after."
              />
              <IndexItem
                icon={Search}
                title="Plagiarism & data integrity"
                desc="Every submission runs through an automated in-corpus similarity check before review, and citations are validated against OpenAlex during production to catch unresolvable or fabricated references."
              />
              <IndexItem
                icon={Scale}
                title="Conflicts of interest"
                desc="Reviewers and editors must disclose any competing interest with a submission's authors or subject matter, and recuse themselves from handling it where one exists."
              />
              <IndexItem
                icon={AlertTriangle}
                title="Corrections & retractions"
                desc="Post-publication integrity issues are handled per COPE/ICMJE convention — Corrigendum, Erratum, Expression of Concern, or Retraction — and published as a permanent, linked addendum. See the Resources → Guides tab for the full policy."
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

      {/* Architecture overview */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Platform architecture</h2>
        <p className="mt-2 text-sm text-muted-foreground text-justify">
          The platform is built as an event-driven microservices system. Each box below is
          a separately deployable service communicating via an async message broker.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ARCHITECTURE.map((svc) => (
            <Card key={svc.name} className="paper-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <svc.icon className="h-5 w-5 text-primary" />
                  <Badge variant="outline" className="font-mono text-[0.6rem]">{svc.db}</Badge>
                </div>
                <p className="mt-2 font-display text-base font-semibold">{svc.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{svc.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Indexing & Discovery */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Indexing &amp; discovery</h2>
        <Card className="paper-card mt-4">
          <CardContent className="p-6">
            <p className="text-sm leading-relaxed text-foreground/85 text-justify">
              <strong>Reality check.</strong> You cannot “push” articles directly to
              Scopus or Web of Science via an API. These are human-curated databases.
              You must apply to be indexed, and once accepted they pull your data.
              Google Scholar, however, crawls automatically.
            </p>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-3">
              <IndexItem
                icon={Search}
                title="Google Scholar"
                desc="Crawled automatically. citation_* meta tags + sitemap.xml are emitted on every published article page."
              />
              <IndexItem
                icon={Globe2}
                title="OAI-PMH 2.0"
                desc="Dublin Core XML feed consumed daily by Scopus and WoS harvesters. Every published article is mapped to the Dublin Core standard."
              />
              <IndexItem
                icon={FileText}
                title={`${DOI_REGISTRAR} DOI`}
                desc={`A real, permanently-resolving DOI is minted via the ${DOI_REGISTRAR} API upon publication.`}
              />
              <IndexItem
                icon={Database}
                title="RePEc / IDEAS / EconPapers"
                desc="A real ReDIF metadata feed — the format RePEc's own crawler pulls. IDEAS and EconPapers are front-ends over the same RePEc database, so this one feed reaches all three once RePEc assigns a registered archive code."
              />
              <IndexItem
                icon={FileText}
                title="DataCite"
                desc={`Reached indirectly: every DOI minted via ${DOI_REGISTRAR} is itself registered with DataCite as part of that deposit — there is no separate direct DataCite integration on top of it.`}
              />
              <IndexItem
                icon={Landmark}
                title="ROAD, ISI, ResearchBib, Citefactor, SAJI"
                desc="Manual-application directories with no public submission API. Application status is self-reported and admin-maintained, never claimed as indexed until a reviewer has actually accepted the listing."
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/oai-pmh?verb=Identify" target="_blank" rel="noreferrer">
                  <Globe2 className="mr-2 h-3.5 w-3.5" /> View OAI-PMH endpoint
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/api/redif?type=archive" target="_blank" rel="noreferrer">
                  <Database className="mr-2 h-3.5 w-3.5" /> View ReDIF feed
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* APC + Subscriptions */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Article processing charges &amp; subscriptions</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="paper-card">
            <CardContent className="p-6">
              <CreditCard className="h-6 w-6 text-primary" />
              <p className="mt-3 font-display text-lg font-semibold">Author pays (APC)</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Triggered when an article is accepted. The author is invoiced USD 97.
                Payment is verified via webhook before the production service
                generates the final PDF and publishes.
              </p>
              <p className="mt-3 font-mono text-lg font-semibold">USD 97</p>
            </CardContent>
          </Card>
          <Card className="paper-card">
            <CardContent className="p-6">
              <Users className="h-6 w-6 text-primary" />
              <p className="mt-3 font-display text-lg font-semibold">Reader subscription</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Handled via your choice of payment provider. This doesn't gate PDF access —
                every published article is genuinely open access, no subscription required.
                It unlocks convenience features instead: bundled/batch downloads, saved
                reading lists, and early access to accepted-in-production articles.
              </p>
              <p className="mt-3 font-mono text-lg font-semibold">
                USD 10 / mo · USD 97 / yr · USD 997 / yr (institutional)
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Compliance */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Compliance</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ComplianceCard icon={ShieldCheck} title="PCI-DSS" desc="Credit card data never touches our servers — handled entirely by the hosted checkout of your chosen payment gateway." />
          <ComplianceCard icon={Scale} title="GDPR / CCPA" desc="Account deletion cascades through all databases, anonymising review comments but retaining published papers." />
          <ComplianceCard icon={Workflow} title="Audit log" desc="Every state transition is recorded in an append-only audit log with user + metadata." />
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-md border border-border bg-card p-8 text-center">
        <p className="eyebrow">{t("joinConversation")}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          {t("ctaHeadline")}
        </h2>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button onClick={() => useApp.getState().setAuthSheetOpen(true)}>
            {t("signInToSubmit")}
          </Button>
          <Button variant="outline" onClick={() => setView("browse")}>
            {t("browseAll")}
          </Button>
        </div>
      </section>
    </div>
  );
}

const ARCHITECTURE = [
  {
    name: "Identity & Access",
    description: "JWT/OAuth2 authentication, RBAC across 6 roles, session management.",
    icon: ShieldCheck,
    db: "PostgreSQL",
  },
  {
    name: "Submission & Manuscript",
    description: "Manuscript uploads, metadata extraction, versioning, anonymisation engine.",
    icon: FileText,
    db: "PostgreSQL + S3",
  },
  {
    name: "Workflow & Peer Review",
    description: "State machine, reviewer assignment, deadline tracking, flexible review forms.",
    icon: Workflow,
    db: "MongoDB",
  },
  {
    name: "Production & Typesetting",
    description: "Pandoc/LaTeX conversion to HTML, PDF, XML JATS galleys with journal branding.",
    icon: BookOpen,
    db: "S3",
  },
  {
    name: "Indexing & Discovery",
    description: "OAI-PMH feed, Google Scholar pings, sitemaps, JSON-LD structured data.",
    icon: Globe2,
    db: "Elasticsearch",
  },
  {
    name: "DOI & Metadata",
    description: `${DOI_REGISTRAR} API integration. DOI minted on publication.`,
    icon: FileText,
    db: "PostgreSQL",
  },
  {
    name: "Billing & Subscription",
    description: "APC invoicing + recurring subscriptions via Stripe, PayPal, PayMongo, Xendit, or Lemon Squeezy. ACID-compliant financial data.",
    icon: CreditCard,
    db: "PostgreSQL",
  },
  {
    name: "Notification",
    description: "Email (SES), SMS (Twilio), and in-app notifications for every state change.",
    icon: Bell,
    db: "Redis",
  },
  {
    name: "Audit & Event Sourcing",
    description: "Append-only event log consumed by all services for traceability.",
    icon: Database,
    db: "PostgreSQL",
  },
];

function IndexItem({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function ComplianceCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-5">
        <Icon className="h-5 w-5 text-primary" />
        <p className="mt-2 font-display text-base font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
