"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOI_REGISTRAR } from "@/lib/site";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Video,
  Newspaper,
  FileText,
  BookMarked,
  Clock,
  ArrowRight,
  Mail,
} from "lucide-react";

interface Reading {
  title: string;
  excerpt: string;
  body: string[];
  meta: string;
}

const BLOGS: Reading[] = [
  {
    title: "Why Multidisciplinary Research Needs Its Own Editorial Standards",
    excerpt: "A single-discipline review checklist breaks down the moment a manuscript spans three fields at once. Here's how we handle it.",
    meta: "Editorial Team · 6 min read",
    body: [
      "Most peer-review checklists were written for a single discipline, then reused everywhere. That works fine until a manuscript combines, say, climate modelling with public-health policy and a qualitative fieldwork component — and no single reviewer is equipped to evaluate all three at once.",
      "Our approach is to assign discipline-matched reviewers per component rather than forcing one generalist to sign off on the whole paper. The editor's job becomes synthesis: reconciling feedback that sometimes pulls in different directions, and making sure the final decision reflects the manuscript as a whole rather than the loudest reviewer.",
      "It's slower than a single-track review, but it's the only way we've found to genuinely evaluate cross-disciplinary work on its own terms instead of forcing it into a discipline it doesn't quite belong to.",
    ],
  },
  {
    title: "Demystifying the APC: What You're Actually Paying For",
    excerpt: "USD 97 sounds arbitrary until you see what it actually funds — editorial handling, DOI registration, typesetting, and permanent hosting.",
    meta: "Editorial Team · 4 min read",
    body: [
      `An Article Processing Charge often reads as an abstract toll on publishing. In practice it funds four concrete things: editorial and peer-review coordination, DOI registration with ${DOI_REGISTRAR}, production (typesetting into PDF/HTML/JATS), and indefinite open-access hosting.`,
      "It's charged once, only after acceptance — never at submission, and never as a condition of getting reviewed. If a reviewer's decision and an author's ability to pay were linked in any way, the review process would be compromised, so we keep waiver requests and peer-review outcomes handled by entirely separate parts of the editorial office.",
      "If the fee is a genuine barrier, ask for a waiver before you assume you can't publish with us — see the APC Waiver guide below.",
    ],
  },
  {
    title: "A Plain-Language Guide to Double-Blind Peer Review",
    excerpt: "What actually gets hidden, what doesn't, and why anonymisation is harder than it sounds.",
    meta: "Editorial Team · 5 min read",
    body: [
      "Double-blind review means neither the author nor the reviewer knows the other's identity. Sounds simple — in practice, author names, affiliations, funding acknowledgements, and even PDF metadata all have to be stripped before a manuscript reaches a reviewer.",
      "It isn't perfect: a sufficiently niche dataset or a distinctive writing style can sometimes give away authorship. But the goal isn't cryptographic anonymity, it's removing the obvious, easily-biased signals — institutional prestige, seniority, geography — so the work gets judged on its own merits first.",
      "Where a field's norms make blinding impractical or counterproductive (some qualitative and community-based research, for instance), we offer single-blind or fully open review instead.",
    ],
  },
  {
    title: "Open Access Licensing, Explained Without the Legalese",
    excerpt: "CC BY 4.0 in one sentence: anyone can share and adapt your work, as long as they credit you.",
    meta: "Editorial Team · 3 min read",
    body: [
      "Every article we publish carries a Creative Commons Attribution 4.0 (CC BY 4.0) license by default. In plain terms: anyone — a student, a journalist, a competing lab — can copy, redistribute, and even build on your published work commercially, as long as they credit you as the original author.",
      "This is different from a subscription paywall model, where readers (or their institution) pay for access after publication, and different from a fully restrictive copyright transfer, where the publisher — not the author — controls reuse.",
      "CC BY 4.0 is the license most funder mandates (Plan S, many NIH/UKRI grants) require, so publishing under it also keeps you compliant with those obligations without any extra paperwork on your end.",
    ],
  },
  {
    title: "How Editors Actually Match Reviewers to Manuscripts",
    excerpt: "It isn't random, and it isn't just 'ask whoever's free' — here's the matching logic behind the scenes.",
    meta: "Editorial Team · 4 min read",
    body: [
      "When a manuscript clears initial screening, it's matched against our reviewer pool using the paper's discipline tag and extracted keywords against each reviewer's stated expertise. Reviewers are ranked by match strength, and the top candidates are invited — typically two or three per manuscript.",
      "Reviewers can accept, decline, or request an extension on the standard 14-day window. If too many decline, the editor widens the search rather than settling for a weaker match, since a mismatched reviewer produces feedback that isn't useful to anyone.",
      "This is also why keeping your reviewer profile's expertise keywords current matters if you're on our reviewer pool — better matching means fewer irrelevant invitations and reviews you're actually qualified to give.",
    ],
  },
  {
    title: "Reading Your Rejection Letter: What to Do Next",
    excerpt: "A rejection isn't always a dead end. Here's how to read reviewer feedback and decide your next move.",
    meta: "Editorial Team · 5 min read",
    body: [
      "A rejection can mean several different things: the work doesn't fit our scope, the methodology has a fixable gap, or reviewers found the contribution too incremental for this venue. The editor's decision letter and the underlying reviewer comments together should tell you which one applies.",
      "If reviewers flagged a specific, addressable methodological issue, that's often worth fixing and resubmitting elsewhere — the feedback has value even if this particular venue wasn't the right fit. If it was a scope mismatch, no amount of revision will change that outcome here, and your time is better spent elsewhere.",
      "We don't offer formal appeals for straightforward scope rejections, but if you believe a review contains a factual error, you can write to the handling editor directly and ask for a second read.",
    ],
  },
];

interface Guide {
  title: string;
  summary: string;
  body: string[];
}

const GUIDES: Guide[] = [
  {
    title: "Author Submission Guide",
    summary: "Everything required before you upload a manuscript: metadata, author list, and what happens after you hit submit.",
    body: [
      "Before submitting, you'll need: the manuscript file, a title and abstract, 3–8 keywords, a discipline tag, the full author list with affiliations and (ideally) ORCID iDs, and — if applicable — funder information and links to any underlying datasets or code repositories.",
      "Once submitted, your manuscript enters initial editorial screening for scope fit and an automated in-corpus similarity check. If it passes, it's anonymised for double-blind review and assigned to discipline-matched reviewers. You can track every stage from your dashboard's \"My Articles\" tab.",
      "There's no submission fee. The APC is only invoiced after acceptance.",
    ],
  },
  {
    title: "Formatting & Citation Style Guide",
    summary: "Manuscript formatting expectations and how in-text citations map to our reference list.",
    body: [
      "We don't enforce a single rigid template at submission — focus on clarity and completeness. At production stage, accepted manuscripts are typeset into our house style automatically.",
      "References should be complete enough to resolve unambiguously (full author list, title, venue, year, and a DOI where one exists). Where a DOI is available, we validate it against OpenAlex during production to catch broken or mistyped citations before publication.",
      "Figures and tables should be referenced in the text in the order they appear and include a self-contained caption — a reader should understand a figure without needing to reread the surrounding paragraph.",
    ],
  },
  {
    title: "Reviewer Handbook",
    summary: "What we expect from a review, how scoring works, and the 14-day response window.",
    body: [
      "A complete review includes an overall score (1–5), a recommendation (Accept / Minor revisions / Major revisions / Reject), a confidence score, and separate comments for the author and for the editor. Author-facing comments should be specific and actionable — \"needs more rigor\" isn't useful; \"the sample size in Section 3.2 is underpowered for the claimed effect size\" is.",
      "You have 14 days from accepting an invitation to submit your review. If you need more time, request an extension rather than letting the deadline lapse silently — editors would rather adjust the timeline than lose a good-fit reviewer.",
      "Keep author identity out of your written comments even when you can guess it from the subject matter — the blinding only works if both sides respect it.",
    ],
  },
  {
    title: "APC Waiver Request Guide",
    summary: "How to request a full or partial fee waiver, and how we keep it separate from the review decision.",
    body: [
      "If the USD 97 APC is a genuine barrier, request a waiver from your dashboard once your article is accepted (or earlier, if you already know it will be an issue). Briefly explain your funding situation — no elaborate documentation is required for standard requests.",
      "Waiver requests are reviewed by the editorial office, not by your assigned reviewers or handling editor, and never influence the peer-review outcome. A request being under review does not delay production once approved.",
      "Partial waivers are available where a full waiver isn't warranted but the full fee is still a genuine burden — ask, rather than assuming it's all-or-nothing.",
    ],
  },
  {
    title: "Data & Code Availability Guide",
    summary: "How to link an underlying dataset or code repository to your published article.",
    body: [
      "If your research has an associated dataset, code repository, or supplementary materials, you can attach it to your submission as a dataset link. We support linking to Zenodo records directly, which gives the dataset its own citable DOI alongside your article's.",
      "Linking data isn't mandatory for every submission, but it's required where a funder mandate specifies open data, and it's strongly encouraged everywhere else — it materially improves reproducibility and how easily others can build on your work.",
      "Update the link if your repository moves; broken data links are one of the most common post-publication correction requests we receive.",
    ],
  },
  {
    title: "Corrections, Retractions & Expressions of Concern Guide",
    summary: "What each notice type means and how to report a concern about a published article.",
    body: [
      "We follow COPE/ICMJE convention for post-publication integrity issues. A Corrigendum fixes an author error; an Erratum fixes a publisher/production error; an Expression of Concern flags an unresolved doubt pending investigation; a Retraction withdraws the findings entirely.",
      "To report a concern about any published article, email editorial@eleventhpress.org with the article's DOI and a description of the issue. The editorial office investigates independently of the original handling editor where a conflict of interest is possible.",
      "Every notice is published as a linked, permanent addendum to the original article — the original is never silently deleted or altered.",
    ],
  },
];

interface Book {
  title: string;
  author: string;
  note: string;
}

const BOOKS: Book[] = [
  { title: "The Craft of Research", author: "Wayne C. Booth, Gregory G. Colomb, Joseph M. Williams & Joseph Bizup", note: "The standard reference for turning a research question into an argument a reader can follow." },
  { title: "How to Write a Lot: A Practical Guide to Productive Academic Writing", author: "Paul J. Silvia", note: "Short, practical, and aimed squarely at the habit of writing rather than motivation or talent." },
  { title: "Writing Science: How to Write Papers That Get Cited and Proposals That Get Funded", author: "Joshua Schimel", note: "Frames every paper as a story with a problem and a resolution — useful across disciplines, not just the sciences." },
  { title: "The Chicago Guide to Communicating Science", author: "Scott L. Montgomery", note: "Strong on translating technical findings for readers outside your immediate subfield." },
  { title: "Stylish Academic Writing", author: "Helen Sword", note: "A readable argument against unnecessarily dense academic prose, backed by analysis of published writing." },
  { title: "The Elements of Style", author: "William Strunk Jr. & E. B. White", note: "The classic, still-relevant primer on clear sentence-level writing." },
];

interface Planned {
  title: string;
  blurb: string;
}

const TRAININGS: Planned[] = [
  { title: "Systematic Manuscript Writing for Multidisciplinary Audiences", blurb: "Structuring a paper so reviewers outside your immediate subfield can still evaluate it fairly." },
  { title: "Statistical Reporting & Reproducibility Essentials", blurb: "Common statistical reporting gaps that trigger revision requests, and how to avoid them upfront." },
  { title: "Navigating Peer Review: A Reviewer's Primer", blurb: "For first-time reviewers — what a useful, actionable review actually looks like." },
  { title: "Research Data Management & FAIR Principles", blurb: "Making your data Findable, Accessible, Interoperable, and Reusable — and why funders increasingly require it." },
  { title: "From Preprint to Publication: A Practical Roadmap", blurb: "Deciding when and where to preprint, and how it interacts with journal submission." },
];

const WEBINARS: Planned[] = [
  { title: "Understanding Open Access & CC BY 4.0 Licensing", blurb: "What CC BY 4.0 actually permits, and how it interacts with funder mandates." },
  { title: "Choosing the Right Journal for Your Research", blurb: "Matching scope, audience, and venue reputation to your specific manuscript." },
  { title: "Responding to Reviewer Comments Without Losing Your Mind", blurb: "A practical framework for triaging and responding to a major-revisions decision." },
  { title: "Research Integrity: Avoiding Common Pitfalls", blurb: "Authorship disputes, duplicate submission, and other issues that are easy to avoid and hard to undo." },
  { title: "Metrics That Matter: Citations, Altmetrics & Impact", blurb: "Reading citation counts and altmetrics for what they actually measure — and what they don't." },
];

export function ResourcesView() {
  const t = useTranslations("resources");
  const [openBlog, setOpenBlog] = useState<Reading | null>(null);
  const [openGuide, setOpenGuide] = useState<Guide | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Tabs defaultValue="trainings" className="mt-8">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="trainings">
            <GraduationCap className="mr-1.5 h-3.5 w-3.5" /> {t("tabTrainings")}
          </TabsTrigger>
          <TabsTrigger value="webinars">
            <Video className="mr-1.5 h-3.5 w-3.5" /> {t("tabWebinars")}
          </TabsTrigger>
          <TabsTrigger value="blogs">
            <Newspaper className="mr-1.5 h-3.5 w-3.5" /> {t("tabBlogs")}
          </TabsTrigger>
          <TabsTrigger value="guides">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> {t("tabGuides")}
          </TabsTrigger>
          <TabsTrigger value="books">
            <BookMarked className="mr-1.5 h-3.5 w-3.5" /> {t("tabBooks")}
          </TabsTrigger>
        </TabsList>

        {/* Trainings & courses */}
        <TabsContent value="trainings" className="mt-6 space-y-4">
          <ComingSoonNotice text={t("comingSoonTrainings")} />
          <div className="grid gap-3 sm:grid-cols-2">
            {TRAININGS.map((p) => (
              <PlannedCard key={p.title} icon={GraduationCap} item={p} />
            ))}
          </div>
        </TabsContent>

        {/* Webinars */}
        <TabsContent value="webinars" className="mt-6 space-y-4">
          <ComingSoonNotice text={t("comingSoonWebinars")} />
          <div className="grid gap-3 sm:grid-cols-2">
            {WEBINARS.map((p) => (
              <PlannedCard key={p.title} icon={Video} item={p} />
            ))}
          </div>
        </TabsContent>

        {/* Blogs */}
        <TabsContent value="blogs" className="mt-6 space-y-3">
          {BLOGS.map((b) => (
            <Card key={b.title} className="paper-card cursor-pointer" onClick={() => setOpenBlog(b)}>
              <CardContent className="p-5">
                <p className="font-display text-base font-semibold">{b.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{b.excerpt}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {b.meta}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-[oklch(0.42_0.18_295)]">
                    {t("readMore")} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Guides */}
        <TabsContent value="guides" className="mt-6 space-y-3">
          {GUIDES.map((g) => (
            <Card key={g.title} className="paper-card cursor-pointer" onClick={() => setOpenGuide(g)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold">{g.title}</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">{g.summary}</p>
                  </div>
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Books */}
        <TabsContent value="books" className="mt-6">
          <p className="mb-4 text-xs text-muted-foreground">{t("booksDisclaimer")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {BOOKS.map((b) => (
              <Card key={b.title} className="paper-card">
                <CardContent className="p-5">
                  <BookMarked className="h-5 w-5 text-primary" />
                  <p className="mt-2 font-display text-sm font-semibold leading-snug">{b.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{b.author}</p>
                  <p className="mt-2 text-xs leading-relaxed text-foreground/80">{b.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!openBlog} onOpenChange={(o) => !o && setOpenBlog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {openBlog && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{openBlog.title}</DialogTitle>
              </DialogHeader>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {openBlog.meta}
              </p>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/85">
                {openBlog.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!openGuide} onOpenChange={(o) => !o && setOpenGuide(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {openGuide && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{openGuide.title}</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/85">
                {openGuide.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComingSoonNotice({ text }: { text: string }) {
  return (
    <Card className="paper-card border-dashed">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-muted-foreground">{text}</p>
        <Button variant="outline" size="sm" asChild>
          <a href="mailto:editorial@eleventhpress.org?subject=Topic%20suggestion">
            <Mail className="mr-2 h-3.5 w-3.5" /> Suggest a topic
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function PlannedCard({ icon: Icon, item }: { icon: any; item: Planned }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5 text-primary" />
          <Badge variant="outline" className="text-[0.6rem]">In development</Badge>
        </div>
        <p className="mt-2 font-display text-sm font-semibold leading-snug">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{item.blurb}</p>
      </CardContent>
    </Card>
  );
}
