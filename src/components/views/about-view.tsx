"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

export function AboutView() {
  const { setView } = useApp();
  const t = useTranslations("home");
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
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/85">
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
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/85">
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
          <p>
            The state machine governing an article’s lifecycle is:
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">DRAFT → SUBMITTED → UNDER_REVIEW → REVISIONS_REQUIRED → ACCEPTED → IN_PRODUCTION → PUBLISHED</code>.
            Editors may also REJECT or WITHDRAW at any point.
          </p>
        </div>
      </section>

      {/* Architecture overview */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Platform architecture</h2>
        <p className="mt-2 text-sm text-muted-foreground">
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
            <p className="text-sm leading-relaxed text-foreground/85">
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
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/oai-pmh?verb=Identify" target="_blank" rel="noreferrer">
                  <Globe2 className="mr-2 h-3.5 w-3.5" /> View OAI-PMH endpoint
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
