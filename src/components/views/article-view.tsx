"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { ArticleDetail } from "@/lib/types";
import { DISCIPLINE_COLORS, parseAuthors, formatCitation, CORRECTION_TYPE_LABELS, CorrectionType } from "@/lib/article";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Quote,
  Eye,
  Download,
  Share2,
  FileText,
  BookOpen,
  ExternalLink,
  Database,
  Loader2,
  CheckCircle2,
  Calendar,
  Library,
  ShieldCheck,
  Tag,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Globe2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export function ArticleView() {
  const { articleId, setView, openArticle, user } = useApp();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [related, setRelated] = useState<ArticleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [citationFormat, setCitationFormat] = useState<"apa" | "bibtex" | "ris">("apa");
  const [publicReviews, setPublicReviews] = useState<any[] | null>(null);
  const [openReviewStatus, setOpenReviewStatus] = useState<{ openReview: boolean; published: boolean } | null>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [references, setReferences] = useState<any[]>([]);
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const canIssueCorrection = !!user && ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(user.role);

  useEffect(() => {
    if (!articleId) {
      setView("browse");
      return;
    }
    setLoading(true);
    setPublicReviews(null);
    setOpenReviewStatus(null);
    setBodyHtml(null);
    apiFetch<ArticleDetail>(`/api/articles/${articleId}`)
      .then((a) => {
        setArticle(a);
        // Fetch correction/retraction history
        apiFetch<{ corrections: any[] }>(`/api/articles/${articleId}/corrections`)
          .then((r) => setCorrections(r.corrections || []))
          .catch(() => setCorrections([]));
        // Fetch references
        apiFetch<{ references: any[] }>(`/api/articles/${articleId}/references`)
          .then((r) => setReferences(r.references || []))
          .catch(() => setReferences([]));
        // Fetch the manuscript's real body content (extracted/converted at
        // publish time) for inline display — replaces fabricated filler.
        apiFetch<{ bodyHtml: string | null }>(`/api/articles/${articleId}/body`)
          .then((r) => setBodyHtml(r.bodyHtml))
          .catch(() => setBodyHtml(null));
        // Fetch related
        apiFetch<{ items: ArticleDetail[] }>(
          `/api/articles?discipline=${encodeURIComponent(a.discipline)}&pageSize=4`
        ).then(({ items }) => {
          setRelated(items.filter((i) => i.id !== a.id).slice(0, 3));
        });
        // Fetch public reviews (open peer review)
        apiFetch<any>(`/api/articles/${articleId}/reviews`)
          .then((r) => {
            setOpenReviewStatus({ openReview: r.openReview, published: r.published });
            if (r.openReview && r.published && r.reviews) {
              setPublicReviews(r.reviews);
            }
          })
          .catch(() => {
            // 403 means article isn't open-review — that's fine
          });
      })
      .catch(() => toast.error("Failed to load article"))
      .finally(() => setLoading(false));
  }, [articleId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-md bg-muted/30" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="font-display text-2xl">Article not found</p>
        <Button className="mt-4" onClick={() => setView("browse")}>
          Back to browse
        </Button>
      </div>
    );
  }

  const authors = parseAuthors(article.authors);
  const keywords = article.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  const citation = formatCitation({
    title: article.title,
    authors: article.authors,
    publishedAt: article.publishedAt,
    doi: article.doi,
    journalName: article.journalName,
    volume: article.volume,
    issueNumber: article.issueNumber,
    year: article.year,
  });

  const bibtex = `@article{${article.doi?.replace(/[^a-z0-9]/gi, "") || "epip"},
  title   = {${article.title}},
  author  = {${authors.map((a) => a.name).join(" and ")}},
  journal = {${article.journalName ?? "EPIP Int. J. Multidiscip. Res."}},
  year    = {${article.year ?? new Date(article.publishedAt || Date.now()).getFullYear()}},
  volume  = {${article.volume ?? ""}},
  number  = {${article.issueNumber ?? ""}},
  doi     = {${article.doi ?? ""}},
}`;

  const ris = `TY  - JOUR
TI  - ${article.title}
AU  - ${authors.map((a) => a.name).join("\nAU  - ")}
JO  - ${article.journalName ?? "EPIP Int. J. Multidiscip. Res."}
PY  - ${article.year ?? new Date(article.publishedAt || Date.now()).getFullYear()}
VL  - ${article.volume ?? ""}
IS  - ${article.issueNumber ?? ""}
DO  - ${article.doi ?? ""}
ER  - `;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: article.title,
    description: article.abstract,
    author: authors.map((a) => ({
      "@type": "Person",
      name: a.name,
      affiliation: { "@type": "Organization", name: a.affiliation },
      ...(a.orcid ? { identifier: `https://orcid.org/${a.orcid}` } : {}),
    })),
    datePublished: article.publishedAt,
    keywords: keywords.join(", "),
    isPartOf: {
      "@type": "PublicationIssue",
      isPartOf: {
        "@type": "PublicationVolume",
        volumeNumber: article.volume,
        isPartOf: {
          "@type": "Periodical",
          name: article.journalName,
          issn: article.journalIssn,
        },
      },
      issueNumber: article.issueNumber,
    },
    publisher: {
      "@type": "Organization",
      name: article.publisher,
    },
    identifier: article.doi ? `https://doi.org/${article.doi}` : undefined,
    inLanguage: "en",
  };

  function copyCitation() {
    const text = citationFormat === "apa" ? citation : citationFormat === "bibtex" ? bibtex : ris;
    navigator.clipboard.writeText(text);
    toast.success("Citation copied", { description: `${citationFormat.toUpperCase()} format` });
  }

  return (
    <article className="page-enter mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Inject JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeadMetas article={article} authors={authors} />

      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => setView("browse")} className="mb-6 text-muted-foreground hover:text-[oklch(0.42_0.18_295)]">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to browse
      </Button>

      {/* Correction / retraction banner */}
      {article.integrityStatus && article.integrityStatus !== "NORMAL" && (
        <IntegrityBanner status={article.integrityStatus} corrections={corrections} />
      )}

      {/* Editor-only: issue a correction/retraction */}
      {canIssueCorrection && article.status === "PUBLISHED" && (
        <div className="mb-4 flex justify-end">
          <IssueCorrectionDialog
            articleId={article.id}
            onIssued={(updated, newCorrections) => {
              setArticle((prev) => (prev ? { ...prev, integrityStatus: updated } : prev));
              setCorrections(newCorrections);
            }}
          />
        </div>
      )}

      {/* Premium Header */}
      <header className="border-b border-[oklch(0.76_0.11_294/0.15)] pb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-[oklch(0.76_0.11_294/0.3)] bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)]">
            {article.discipline}
          </Badge>
          <Badge variant="outline" className="border-[oklch(0.76_0.11_294/0.2)] bg-[oklch(0.96_0.01_285)] text-muted-foreground">
            {article.reviewModel.replace("_", "-")}
          </Badge>
          {openReviewStatus?.openReview && (
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 gap-1">
              <Globe2 className="h-3 w-3" /> Open peer review
            </Badge>
          )}
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            DOI: {article.doi} · Status: {article.status}
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
          {article.title}
        </h1>

        {/* Authors */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
          {authors.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {a.name.split(" ").map((p) => p[0]).slice(-2).join("")}
              </div>
              <div>
                <p className="font-sans text-sm font-medium leading-tight">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.affiliation}
                  {a.rorId && (
                    <>
                      {" · "}
                      <a
                        href={`https://ror.org/${a.rorId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-dotted underline-offset-2 hover:text-primary"
                      >
                        ROR
                      </a>
                    </>
                  )}
                </p>
                {a.orcid && (
                  <a
                    href={`https://orcid.org/${a.orcid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 font-mono text-[0.65rem] text-primary hover:underline"
                  >
                    ORCID {a.orcid}
                  </a>
                )}
                {a.creditRoles && a.creditRoles.length > 0 && (
                  <p className="mt-0.5 max-w-[16rem] text-[0.65rem] text-muted-foreground">
                    {a.creditRoles.join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Meta bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <MetaTile icon={Calendar} label="Published" value={article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : "—"} />
          <MetaTile icon={Library} label="Volume / Issue" value={article.volume ? `Vol. ${article.volume}, Iss. ${article.issueNumber}` : "—"} />
          <MetaTile icon={Quote} label="Citations" value={String(article.citations)} />
          <MetaTile icon={Eye} label="Views" value={String(article.views)} />
        </div>
      </header>

      {/* Body */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Main column */}
        <div>
          <Tabs defaultValue="article" className="w-full">
            <TabsList className={`grid w-full ${openReviewStatus?.openReview ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="article">Article</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="cite">Cite</TabsTrigger>
              {openReviewStatus?.openReview && (
                <TabsTrigger value="reviews">Peer review</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="article" className="mt-6">
              <div className="prose prose-stone max-w-none">
                <h2 className="font-display text-xl font-semibold">Abstract</h2>
                <p className="dropcap mt-2 text-base leading-relaxed text-foreground/90">
                  {article.abstract}
                </p>

                {article.laySummary && (
                  <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4 not-prose">
                    <p className="eyebrow mb-1">Plain-language summary</p>
                    <p className="text-sm leading-relaxed text-foreground/85">{article.laySummary}</p>
                  </div>
                )}

                <h2 className="mt-8 font-display text-xl font-semibold">Article body</h2>
                {bodyHtml ? (
                  <div
                    className="mt-2 text-sm leading-relaxed text-foreground/80 [&_h1]:mt-6 [&_h1]:font-display [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_p]:mt-2 [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:p-1.5"
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/70 italic">
                    The full text isn’t available for inline preview for this
                    article (its manuscript format doesn’t support in-browser
                    rendering, or the galley hasn’t been generated yet) — use
                    the “Download PDF” button to read the complete article.
                  </p>
                )}

                {references.length > 0 && (
                  <>
                    <h3 className="mt-6 font-display text-lg font-semibold">References</h3>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs text-foreground/70">
                      {references.map((ref) => (
                        <li key={ref.id}>
                          {ref.doi ? (
                            <a
                              href={`https://doi.org/${ref.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-primary hover:underline"
                            >
                              {ref.rawText}
                            </a>
                          ) : (
                            ref.rawText
                          )}
                          {ref.status === "NOT_FOUND" && (
                            <Badge variant="outline" className="ml-1.5 align-middle text-[0.55rem] border-amber-300 bg-amber-50 text-amber-700">
                              unverified
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>

              {/* Keywords */}
              <div className="mt-8 border-t border-border pt-5">
                <p className="eyebrow mb-2">Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k) => (
                    <Badge key={k} variant="secondary" className="gap-1">
                      <Tag className="h-3 w-3" /> {k}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="paper-card">
                  <CardContent className="p-5">
                    <Quote className="h-5 w-5 text-primary" />
                    <p className="mt-2 font-display text-3xl font-semibold">{article.citations}</p>
                    <p className="text-xs text-muted-foreground">Crossref citation count</p>
                  </CardContent>
                </Card>
                <Card className="paper-card">
                  <CardContent className="p-5">
                    <Eye className="h-5 w-5 text-primary" />
                    <p className="mt-2 font-display text-3xl font-semibold">{article.views}</p>
                    <p className="text-xs text-muted-foreground">Page views (all time)</p>
                  </CardContent>
                </Card>
                <Card className="paper-card">
                  <CardContent className="p-5">
                    <Download className="h-5 w-5 text-primary" />
                    <p className="mt-2 font-display text-3xl font-semibold">{article.downloads}</p>
                    <p className="text-xs text-muted-foreground">PDF downloads</p>
                  </CardContent>
                </Card>
                <Card className="paper-card">
                  <CardContent className="p-5">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <p className="mt-2 font-display text-3xl font-semibold">{article.plagiarismScore ?? "—"}%</p>
                    <p className="text-xs text-muted-foreground">In-corpus similarity</p>
                  </CardContent>
                </Card>
              </div>
              <div className="mt-5 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Indexing status</p>
                <ul className="mt-2 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Crossref DOI registered and metadata deposited
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    OAI-PMH 2.0 feed updated (Dublin Core)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Google Scholar citation_* meta tags present on page
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    JSON-LD ScholarlyArticle structured data embedded
                  </li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="cite" className="mt-6">
              <Card className="paper-card">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="eyebrow">Cite this article</p>
                    <div className="flex gap-2">
                      {(["apa", "bibtex", "ris"] as const).map((fmt) => (
                        <Button
                          key={fmt}
                          variant={citationFormat === fmt ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setCitationFormat(fmt)}
                        >
                          {fmt.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <pre className="mt-4 max-h-72 overflow-auto rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed epip-scroll">
{citationFormat === "apa" ? citation : citationFormat === "bibtex" ? bibtex : ris}
                  </pre>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={copyCitation}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Copy citation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Open peer review tab */}
            {openReviewStatus?.openReview && (
              <TabsContent value="reviews" className="mt-6">
                <OpenPeerReviewPanel reviews={publicReviews} published={openReviewStatus.published} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* PDF galley */}
          <Card className="paper-card">
            <CardContent className="p-5">
              <p className="eyebrow">Galleys</p>
              <div className="mt-3 space-y-2">
                <Button
                  className="w-full justify-start"
                  variant="default"
                  onClick={async () => {
                    try {
                      const r = await apiFetch<{ url: string }>(`/api/articles/${article.id}/galley?format=pdf`);
                      window.open(r.url, "_blank");
                    } catch (e: any) {
                      toast.error("Galley not available", { description: e.message });
                    }
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const r = await apiFetch<{ url: string }>(`/api/articles/${article.id}/galley?format=html`);
                      window.open(r.url, "_blank");
                    } catch (e: any) {
                      toast.error("Galley not available", { description: e.message });
                    }
                  }}
                >
                  <BookOpen className="mr-2 h-4 w-4" /> View HTML
                </Button>
                {article.doi && (
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    asChild
                  >
                    <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Crossref landing page
                    </a>
                  </Button>
                )}
              </div>
              <Separator className="my-4" />
              <div className="space-y-1.5 text-xs">
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">S3 key</span>
                  <code className="font-mono">{article.galleyPdfKey || "—"}</code>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">DOI status</span>
                  <Badge variant="outline" className="font-mono text-[0.6rem]">
                    {article.doiStatus}
                  </Badge>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Review model</span>
                  <span>{article.reviewModel.replace("_", " ")}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Share */}
          <Card className="paper-card">
            <CardContent className="p-5">
              <p className="eyebrow">Share</p>
              <div className="mt-3 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://doi.org/${article.doi}`);
                    toast.success("DOI link copied");
                  }}
                >
                  <Share2 className="mr-2 h-3.5 w-3.5" /> Copy DOI link
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Issue info */}
          {article.issueTitle && (
            <Card className="paper-card">
              <CardContent className="p-5">
                <p className="eyebrow">Issue</p>
                <p className="mt-2 font-display text-sm font-semibold">
                  {article.issueTitle}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {article.publisher} · ISSN {article.journalIssn}
                </p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {/* Datasets (Zenodo / OSF / Dryad) */}
      <DatasetsSection articleId={article.id} />

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <p className="eyebrow">Related articles in {article.discipline}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Continue reading</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {related.map((r) => (
              <Card
                key={r.id}
                className="paper-card cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
                onClick={() => openArticle(r.id)}
              >
                <CardContent className="p-4">
                  <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[r.discipline]}`}>
                    {r.discipline}
                  </Badge>
                  <h3 className="mt-2 line-clamp-3 font-display text-sm font-semibold leading-snug">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.citations} citations · {r.views} views
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

const INTEGRITY_BANNER_COPY: Record<string, { label: string; tone: string }> = {
  CORRECTED: { label: "Correction issued", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  UNDER_CONCERN: { label: "Expression of concern", tone: "border-amber-400 bg-amber-100 text-amber-950" },
  RETRACTED: { label: "Retracted", tone: "border-red-400 bg-red-50 text-red-950" },
};

function IntegrityBanner({ status, corrections }: { status: string; corrections: any[] }) {
  const copy = INTEGRITY_BANNER_COPY[status];
  if (!copy) return null;
  const latest = corrections[0];
  return (
    <div className={`mb-6 flex items-start gap-3 rounded-md border p-4 ${copy.tone}`}>
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div>
        <p className="font-display text-sm font-semibold">{copy.label}</p>
        {latest ? (
          <>
            <p className="mt-1 text-xs">{latest.title}</p>
            <p className="mt-1 text-xs opacity-80">{latest.description}</p>
            {latest.doi && (
              <p className="mt-1 font-mono text-[0.65rem] opacity-80">
                Notice DOI: {latest.doi}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs opacity-80">
            This article's status has been updated by the editorial office.
          </p>
        )}
      </div>
    </div>
  );
}

function IssueCorrectionDialog({
  articleId,
  onIssued,
}: {
  articleId: string;
  onIssued: (integrityStatus: string, corrections: any[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<CorrectionType>("CORRIGENDUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function submit() {
    if (!title || !description) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/articles/${articleId}/corrections`, {
        method: "POST",
        body: JSON.stringify({ type, title, description }),
      });
      const { corrections } = await apiFetch<{ corrections: any[] }>(`/api/articles/${articleId}/corrections`);
      const integrityStatus =
        type === "RETRACTION" ? "RETRACTED" : type === "EXPRESSION_OF_CONCERN" ? "UNDER_CONCERN" : "CORRECTED";
      onIssued(integrityStatus, corrections);
      toast.success(`${CORRECTION_TYPE_LABELS[type]} issued`, {
        description: "Crossmark update deposited and the article page now shows the notice.",
      });
      setOpen(false);
      setTitle("");
      setDescription("");
    } catch (e: any) {
      toast.error("Failed to issue correction", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-700">
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Issue correction/retraction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue a correction or retraction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CorrectionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CORRECTION_TYPE_LABELS) as CorrectionType[]).map((k) => (
                  <SelectItem key={k} value={k}>{CORRECTION_TYPE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notice title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of the notice" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what was wrong and, if applicable, how it was corrected. This will be shown publicly on the article page."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This mints a new DOI for the notice, deposits it to Crossref, and re-deposits the
            original DOI with a Crossmark update pointing at it. This cannot be undone from the UI.
          </p>
          <Button onClick={submit} disabled={submitting || !title || !description} className="w-full">
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Issue {CORRECTION_TYPE_LABELS[type].toLowerCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <p className="mt-1 font-sans text-sm font-semibold">{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * HeadMetas — since Next.js metadata API doesn't run in client components,
 * we inject <meta> tags directly into the DOM. Google Scholar's crawler
 * will read these on the public article page.
 */
function HeadMetas({ article, authors }: { article: ArticleDetail; authors: any[] }) {
  useEffect(() => {
    const tags: HTMLMetaElement[] = [];
    const push = (name: string, content: string) => {
      const t = document.createElement("meta");
      t.name = name;
      t.content = content;
      document.head.appendChild(t);
      tags.push(t);
    };
    push("citation_title", article.title);
    authors.forEach((a, i) => push(`citation_author`, a.name));
    if (article.publishedAt) {
      push("citation_publication_date", new Date(article.publishedAt).toISOString().split("T")[0]);
    }
    push("citation_journal_title", article.journalName || "Eleventh Press International Journal");
    if (article.journalIssn) push("citation_issn", article.journalIssn);
    if (article.volume) push("citation_volume", String(article.volume));
    if (article.issueNumber) push("citation_issue", String(article.issueNumber));
    if (article.doi) push("citation_doi", article.doi);
    // window.location.origin (not a hardcoded domain) so this is always
    // correct for whatever host is actually serving the page.
    push("citation_abstract_html_url", `${window.location.origin}/article/${article.id}`);
    // citation_pdf_url intentionally omitted: Google Scholar requires the
    // PDF be fetchable with no login wall, but the real galley route
    // (/api/articles/[id]/galley) requires auth and, for READER accounts,
    // an active subscription. Pointing Scholar's crawler at an auth-gated
    // URL would fail indexing outright, so there's nothing correct to put
    // here until published articles have a genuinely public download path.

    return () => {
      tags.forEach((t) => t.remove());
    };
  }, [article, authors]);

  return null;
}

// ---------------------------------------------------------------------------
// OpenPeerReviewPanel — displays public reviewer identities, scores,
// recommendations, and comments-to-author for articles published under
// the open peer-review model.
// ---------------------------------------------------------------------------

function OpenPeerReviewPanel({ reviews, published }: { reviews: any[] | null; published: boolean }) {
  if (!published) {
    return (
      <Card className="paper-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-display text-lg font-semibold">Reviews pending publication</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This article is published under the open peer-review model, but the article
                itself has not yet been published. Reviews will be released here
                automatically upon publication.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <Card className="paper-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div>
              <p className="font-display text-lg font-semibold">No public reviews yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This article was published under the open peer-review model, but no
                completed reviews have been marked public. The editorial office may
                still be processing the review file.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <Card className="paper-card bg-emerald-50/40">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Globe2 className="mt-1 h-5 w-5 flex-shrink-0 text-emerald-700" />
            <div>
              <p className="font-display text-base font-semibold text-emerald-900">
                Open peer review — full review history published
              </p>
              <p className="mt-1 text-xs text-emerald-800/80">
                Eleventh Press International Publishing publishes the complete reviewer
                identities, recommendations, scores, and comments-to-author for articles
                that opt into open peer review. Confidential comments-to-editor remain
                private to the editorial office. This practice increases accountability,
                recognises reviewer labour, and provides readers with context for the
                editorial decision.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Reviews"
          value={String(reviews.length)}
          icon={MessageSquare}
        />
        <SummaryStat
          label="Accept"
          value={String(reviews.filter((r) => r.recommendation === "ACCEPT").length)}
          icon={ThumbsUp}
          color="text-emerald-600"
        />
        <SummaryStat
          label="Revisions"
          value={String(reviews.filter((r) => r.recommendation?.includes("REVISIONS")).length)}
          icon={AlertTriangle}
          color="text-amber-600"
        />
        <SummaryStat
          label="Reject"
          value={String(reviews.filter((r) => r.recommendation === "REJECT").length)}
          icon={ThumbsDown}
          color="text-rose-600"
        />
      </div>

      {/* Individual reviews */}
      {reviews.map((r, i) => (
        <Card key={r.id} className="paper-card">
          <CardContent className="p-5">
            {/* Reviewer header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {r.reviewer?.fullName?.split(" ").map((p: string) => p[0]).slice(-2).join("") || "R"}
                </div>
                <div>
                  <p className="font-display text-base font-semibold">{r.reviewer?.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.reviewer?.affiliation}
                    {r.reviewer?.country ? ` · ${r.reviewer.country}` : ""}
                  </p>
                  {r.reviewer?.orcid && (
                    <a
                      href={`https://orcid.org/${r.reviewer.orcid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block font-mono text-[0.65rem] text-primary hover:underline"
                    >
                      ORCID {r.reviewer.orcid}
                    </a>
                  )}
                  {r.reviewer?.expertise && (
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                      Expertise: {r.reviewer.expertise}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <Badge
                  variant="outline"
                  className={`text-[0.65rem] ${
                    r.recommendation === "ACCEPT"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : r.recommendation === "REJECT"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-amber-300 bg-amber-50 text-amber-700"
                  }`}
                >
                  {r.recommendation?.replace(/_/g, " ") || "—"}
                </Badge>
                {r.completedAt && (
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    {new Date(r.completedAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
            </div>

            {/* Scores */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border bg-muted/20 p-2">
                <p className="text-muted-foreground">Overall score</p>
                <p className="font-display text-lg font-semibold">{r.overallScore ?? "—"}/5</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2">
                <p className="text-muted-foreground">Reviewer confidence</p>
                <p className="font-display text-lg font-semibold">{r.confidence ?? "—"}/5</p>
              </div>
            </div>

            {r.conflictOfInterest && (
              <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-[0.7rem] text-amber-800">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                Reviewer declared a conflict of interest.
              </p>
            )}

            {/* Comments to author */}
            {r.commentsToAuthor && (
              <div className="mt-4">
                <p className="eyebrow mb-1">Comments to author</p>
                <div className="rounded-md border border-border bg-muted/20 p-3 text-sm leading-relaxed text-foreground/85">
                  {r.commentsToAuthor}
                </div>
              </div>
            )}

            <p className="mt-3 text-[0.65rem] text-muted-foreground">
              Review #{i + 1} · Confidential comments to editor are not published.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SummaryStat({ label, value, icon: Icon, color = "text-primary" }: { label: string; value: string; icon: any; color?: string }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-4">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="mt-1.5 font-display text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DatasetsSection — displays linked datasets (Zenodo, OSF, Dryad, etc.)
// and shows a deposit dialog for authors/editors.
// ---------------------------------------------------------------------------
function DatasetsSection({ articleId }: { articleId: string }) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    keywords: "",
    license: "CC-BY-4.0",
    accessRight: "open",
  });
  const { token, user } = useApp();
  const canDeposit = token && user && ["AUTHOR", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(user.role);

  useEffect(() => {
    apiFetch<{ datasets: any[] }>(`/api/datasets/zenodo?articleId=${articleId}`)
      .then(({ datasets }) => setDatasets(datasets))
      .catch(() => {});
  }, [articleId]);

  async function deposit() {
    setDepositing(true);
    try {
      const res = await apiFetch<any>("/api/datasets/zenodo", {
        method: "POST",
        body: JSON.stringify({
          articleId,
          ...form,
          keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        toast.success("Dataset deposited", { description: res.message });
        setShowDeposit(false);
        setForm({ title: "", description: "", keywords: "", license: "CC-BY-4.0", accessRight: "open" });
        // Refresh
        const { datasets } = await apiFetch<{ datasets: any[] }>(`/api/datasets/zenodo?articleId=${articleId}`);
        setDatasets(datasets);
      } else {
        toast.error("Deposit failed", { description: res.message });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDepositing(false);
    }
  }

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Linked datasets</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Research data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Datasets deposited on Zenodo, OSF, Dryad, or Figshare and linked via Crossref <code className="font-mono text-xs">isSupplementedBy</code> relations.
          </p>
        </div>
        {canDeposit && (
          <Button variant="outline" size="sm" onClick={() => setShowDeposit(!showDeposit)}>
            <Database className="mr-1.5 h-3.5 w-3.5" /> Deposit dataset
          </Button>
        )}
      </div>

      {/* Deposit form */}
      {showDeposit && (
        <Card className="paper-card mt-4">
          <CardContent className="space-y-3 p-5">
            <div className="space-y-1">
              <Label className="text-xs">Dataset title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Supporting data for…" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the dataset contents, format, and collection method…" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Keywords (comma-separated)</Label>
                <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="climate, temperature" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">License</Label>
                <Select value={form.license} onValueChange={(v) => setForm({ ...form, license: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CC-BY-4.0">CC-BY-4.0</SelectItem>
                    <SelectItem value="CC0-1.0">CC0 (Public Domain)</SelectItem>
                    <SelectItem value="CC-BY-NC-4.0">CC-BY-NC-4.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Access</Label>
                <Select value={form.accessRight} onValueChange={(v) => setForm({ ...form, accessRight: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDeposit(false)}>Cancel</Button>
              <Button size="sm" onClick={deposit} disabled={depositing || !form.title}>
                {depositing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Deposit to Zenodo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dataset list */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {datasets.length === 0 ? (
          <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">
            No datasets linked. {canDeposit ? "Click \"Deposit dataset\" to deposit on Zenodo." : ""}
          </p>
        ) : (
          datasets.map((d) => (
            <Card key={d.id} className="paper-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[0.6rem]">{d.repository}</Badge>
                      {d.datasetDoi && (
                        <code className="font-mono text-[0.6rem] text-muted-foreground">{d.datasetDoi}</code>
                      )}
                    </div>
                    <p className="mt-2 font-display text-sm font-semibold">{d.datasetTitle}</p>
                    <a href={d.datasetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> {d.datasetUrl}
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
