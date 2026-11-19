"use client";

import { useTenantBranding, isWhitelabel } from "@/lib/tenant-branding-context";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import type { DiscoveryResult, DiscoverySource } from "@/lib/open-discovery";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { BLOGS, GUIDES, BOOKS, TRAININGS, WEBINARS, type Planned } from "@/lib/resources-content";
import { OFFICIAL_FORMS, FORM_ROLE_LABEL, formPath, formPdfPath, formPlatformPath } from "@/lib/forms";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  GraduationCap,
  Video,
  Newspaper,
  FileText,
  BookMarked,
  Clock,
  ArrowRight,
  Mail,
  Globe2,
  Search,
  ExternalLink,
  Loader2,
  FileDown,
  ShieldCheck,
  FileSignature,
  MonitorCheck,
  CheckCircle2,
  Send,
} from "lucide-react";

const SOURCE_LABEL: Record<DiscoverySource, string> = {
  crossref: "Crossref",
  openalex: "OpenAlex",
  semantic_scholar: "Semantic Scholar",
  eric: "ERIC",
  pubmed_central: "PubMed Central",
  zenodo: "Zenodo",
  core: "CORE",
};

interface DiscoverResponse {
  query: string;
  results: DiscoveryResult[];
  sources: Partial<Record<DiscoverySource, number>>;
}

interface ResourceSearchHit {
  id: string;
  kind: "guide" | "form" | "blog" | "training" | "webinar" | "book";
  title: string;
  description: string;
}

const RESOURCE_KIND_LABEL: Record<ResourceSearchHit["kind"], string> = {
  guide: "Guide",
  form: "Form",
  blog: "Blog",
  training: "Training",
  webinar: "Webinar",
  book: "Book",
};

export function ResourcesView() {
  const t = useTranslations("resources");
  const router = useRouter();
  // Tenant sites show the guides under their own name but not Eleventh
  // Press's own blog posts (see src/lib/resources/tenant-brand.ts).
  const whitelabel = isWhitelabel(useTenantBranding());
  const storedTab = useApp((s) => s.resourcesTab);
  const tab = whitelabel && storedTab === "blogs" ? "guides" : storedTab;
  const setTab = (v: string) => useApp.setState({ resourcesTab: v });

  const [resourceQuery, setResourceQuery] = useState("");
  const [resourceHits, setResourceHits] = useState<ResourceSearchHit[]>([]);
  const [resourceSearching, setResourceSearching] = useState(false);

  useEffect(() => {
    const q = resourceQuery.trim();
    if (q.length < 2) {
      setResourceHits([]);
      return;
    }
    setResourceSearching(true);
    const handle = setTimeout(() => {
      apiFetch<{ results: ResourceSearchHit[] }>(`/api/resources/search?q=${encodeURIComponent(q)}`)
        .then((r) => setResourceHits(whitelabel ? r.results.filter((h) => h.kind !== "blog") : r.results))
        .catch(() => setResourceHits([]))
        .finally(() => setResourceSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [resourceQuery, whitelabel]);

  function openResourceHit(hit: ResourceSearchHit) {
    const blog = hit.kind === "blog" ? BLOGS.find((b) => b.id === hit.id) : undefined;
    const guide = hit.kind === "guide" ? GUIDES.find((g) => g.id === hit.id) : undefined;
    const form = hit.kind === "form" ? OFFICIAL_FORMS.find((f) => f.id === hit.id) : undefined;
    if (form) router.push(formPath(form));
    else if (blog) router.push(`/resources/blog/${blog.slug}`);
    else if (guide) router.push(`/resources/guides/${guide.slug}`);
    else setTab(hit.kind === "training" ? "trainings" : hit.kind === "webinar" ? "webinars" : hit.kind === "blog" ? "blogs" : hit.kind === "guide" ? "guides" : "books");
    setResourceQuery("");
    setResourceHits([]);
  }

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [sourceCounts, setSourceCounts] = useState<DiscoverResponse["sources"] | null>(null);

  async function runDiscoverySearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const data = await apiFetch<DiscoverResponse>(`/api/discover?q=${encodeURIComponent(q)}`);
      setResults(data.results);
      setSourceCounts(data.sources);
    } catch (err: any) {
      setSearchError(err?.message || "Search failed — try again.");
      setResults([]);
      setSourceCounts(null);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t("description")}</p>

        <div className="relative mt-5 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={resourceQuery}
            onChange={(e) => setResourceQuery(e.target.value)}
            placeholder={whitelabel ? "Search guides, trainings, webinars, books…" : "Search guides, blogs, trainings, webinars, books…"}
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {resourceSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

          {resourceHits.length > 0 && (
            <div className="absolute z-20 mt-1.5 w-full rounded-md border border-border bg-card shadow-lg">
              {resourceHits.map((hit) => (
                <button
                  key={hit.id}
                  onClick={() => openResourceHit(hit)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-border p-3 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[0.6rem]">{RESOURCE_KIND_LABEL[hit.kind]}</Badge>
                    <span className="text-sm font-medium">{hit.title}</span>
                  </span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{hit.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1 [&>button]:h-9 [&>button]:flex-none [&>button]:px-3.5">
          <TabsTrigger value="trainings">
            <GraduationCap className="mr-1.5 h-3.5 w-3.5" /> {t("tabTrainings")}
          </TabsTrigger>
          <TabsTrigger value="webinars">
            <Video className="mr-1.5 h-3.5 w-3.5" /> {t("tabWebinars")}
          </TabsTrigger>
          {!whitelabel && (
            <TabsTrigger value="blogs">
              <Newspaper className="mr-1.5 h-3.5 w-3.5" /> {t("tabBlogs")}
            </TabsTrigger>
          )}
          <TabsTrigger value="guides">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> {t("tabGuides")}
          </TabsTrigger>
          <TabsTrigger value="forms">
            <FileSignature className="mr-1.5 h-3.5 w-3.5" /> Forms
          </TabsTrigger>
          <TabsTrigger value="books">
            <BookMarked className="mr-1.5 h-3.5 w-3.5" /> {t("tabBooks")}
          </TabsTrigger>
          <TabsTrigger value="discover">
            <Globe2 className="mr-1.5 h-3.5 w-3.5" /> {t("tabDiscover")}
          </TabsTrigger>
        </TabsList>

        {/* Trainings & courses */}
        <TabsContent value="trainings" className="mt-6 space-y-4">
          <ComingSoonNotice kind="trainings" text={t("comingSoonTrainings")} />
          <div className="grid gap-3 sm:grid-cols-2">
            {TRAININGS.map((p) => (
              <PlannedCard key={p.title} icon={GraduationCap} item={p} />
            ))}
          </div>
        </TabsContent>

        {/* Webinars */}
        <TabsContent value="webinars" className="mt-6 space-y-4">
          <ComingSoonNotice kind="webinars" text={t("comingSoonWebinars")} />
          <div className="grid gap-3 sm:grid-cols-2">
            {WEBINARS.map((p) => (
              <PlannedCard key={p.title} icon={Video} item={p} />
            ))}
          </div>
        </TabsContent>

        {/* Blogs */}
        <TabsContent value="blogs" className="mt-6 space-y-3">
          {!whitelabel && BLOGS.map((b) => (
            <Link key={b.id} href={`/resources/blog/${b.slug}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="paper-card">
                <CardContent className="p-5">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">{b.category}</p>
                  <p className="mt-1 font-display text-base font-semibold">{b.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{b.excerpt}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {b.meta} · Top 10 takeaways, FAQs &amp; references
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      {t("readMore")} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </TabsContent>

        {/* Guides */}
        <TabsContent value="guides" className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Official, versioned guides benchmarked against international publishing standards. Read each online or download
            its branded PDF edition.
          </p>
          {GUIDES.map((g) => (
            <Card key={g.id} className="paper-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      {whitelabel ? g.code.replace(/^EP-/, "") : g.code} · Version {g.version}
                    </p>
                    <Link href={`/resources/guides/${g.slug}`} className="mt-1 block font-display text-base font-semibold hover:text-primary">
                      {g.title}
                    </Link>
                    <p className="mt-1.5 text-sm text-muted-foreground">{g.summary}</p>
                  </div>
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">Benchmarked against: {g.benchmarks.join(" · ")}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/resources/guides/${g.slug}`}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Read guide
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/resources/guides/${g.slug}/pdf`} download>
                      <FileDown className="mr-1.5 h-3.5 w-3.5" /> Download PDF
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Official forms */}
        <TabsContent value="forms" className="mt-6 space-y-8">
          <p className="text-sm text-muted-foreground">
            Official, versioned forms for authors, peer reviewers, editors and anyone with a complaint, concern or request, benchmarked against the same international
            standards as the guides. Each is completed on the platform at the right step and signed electronically; every
            form also has a branded, fillable PDF edition.
          </p>
          {(["author", "reviewer", "editor", "public"] as const).map((role) => (
            <section key={role} aria-labelledby={`forms-${role}`}>
              <h2 id={`forms-${role}`} className="mb-3 flex items-center gap-2 border-b border-[var(--gold-500)]/60 pb-2 font-display text-lg font-semibold">
                {FORM_ROLE_LABEL[role]}
                <span className="text-xs font-normal text-muted-foreground">
                  {OFFICIAL_FORMS.filter((f) => f.role === role).length} forms
                </span>
              </h2>
              <div className="space-y-3">
                {OFFICIAL_FORMS.filter((f) => f.role === role).map((f) => (
                  <Card key={f.id} className="paper-card">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                            {whitelabel ? f.code.replace(/^EP-/, "") : f.code} · Version {f.version}
                          </p>
                          <Link href={formPath(f)} className="mt-1 block font-display text-base font-semibold hover:text-primary">
                            {f.title}
                          </Link>
                          <p className="mt-1.5 text-sm text-muted-foreground">{f.summary}</p>
                          <p className="mt-2 text-xs text-foreground/75">
                            <span className="font-semibold">When:</span> {f.when}
                          </p>
                        </div>
                        <FileSignature className="h-5 w-5 shrink-0 text-primary" />
                      </div>
                      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="min-w-0">Benchmarked against: {f.benchmarks.join(" · ")}</span>
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" asChild>
                          <Link href={formPath(f)}>
                            <FileText className="mr-1.5 h-3.5 w-3.5" /> View form
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={formPdfPath(f)} download>
                            <FileDown className="mr-1.5 h-3.5 w-3.5" /> Fillable PDF
                          </a>
                        </Button>
                        {f.scope !== "offline" && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={formPlatformPath(f)}>
                              <MonitorCheck className="mr-1.5 h-3.5 w-3.5" /> {f.scope === "public" ? "Submit online" : "Complete on the platform"}
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
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

        {/* Discover — live search across free, open scholarly databases */}
        <TabsContent value="discover" className="mt-6 space-y-4">
          <Card className="paper-card border-dashed">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">
                Search free, reputable open scholarly and open-access databases at once —
                Crossref, OpenAlex, Semantic Scholar, ERIC, PubMed Central, and Zenodo — to
                find related work and further reading beyond this platform. No account
                needed; this is the same open infrastructure we use to validate our own
                citations. CORE, BASE, and OER Commons are available to search directly
                below.
              </p>
            </CardContent>
          </Card>

          <form onSubmit={runDiscoverySearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, topic, or author…"
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" disabled={searching || query.trim().length < 2}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>

          {searchError && <p className="text-sm text-destructive">{searchError}</p>}

          {searching && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!searching && searched && results.length === 0 && !searchError && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No results found across any connected source for that query.
            </p>
          )}

          {!searching && results.length > 0 && (
            <div className="space-y-3">
              {sourceCounts && (
                <p className="text-xs text-muted-foreground">
                  {results.length} result{results.length === 1 ? "" : "s"} —{" "}
                  {Object.entries(sourceCounts)
                    .filter(([, n]) => (n ?? 0) > 0)
                    .map(([src, n]) => `${n} from ${SOURCE_LABEL[src as DiscoverySource]}`)
                    .join(", ")}{" "}
                  (deduplicated by DOI where available).
                </p>
              )}
              {results.map((r, i) => (
                <Card key={i} className="paper-card">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold leading-snug">{r.title}</p>
                        {r.authors && <p className="mt-1 text-xs text-muted-foreground">{r.authors}</p>}
                        {(r.venue || r.year) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[r.venue, r.year].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[0.6rem]">
                        {SOURCE_LABEL[r.source]}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={r.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-3 w-3" /> {r.doi ? "View via DOI" : "View source"}
                        </a>
                      </Button>
                      {r.openAccessUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={r.openAccessUrl} target="_blank" rel="noreferrer">
                            <FileText className="mr-1.5 h-3 w-3" /> Open access PDF
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="paper-card">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">About these sources</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The first six are searched live above. CORE, BASE, and OER Commons don't have
                a search API this platform can integrate against without a registered
                agreement (CORE, BASE) or a public API at all (OER Commons) — search them
                directly instead.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <SourceInfo
                  name="Crossref"
                  desc="The official DOI registration agency's public metadata index — 160M+ scholarly records, free REST API, no key required."
                />
                <SourceInfo
                  name="OpenAlex"
                  desc="A free, fully open scholarly graph — the same index this platform uses to validate its own citations and citation counts."
                />
                <SourceInfo
                  name="Semantic Scholar"
                  desc="AI2's free academic search engine, with a public no-key API tier and strong open-access PDF coverage."
                />
                <SourceInfo
                  name="ERIC"
                  desc="The U.S. Dept. of Education's free index of education research, via its public no-key API."
                />
                <SourceInfo
                  name="PubMed Central"
                  desc="NIH/NLM's free full-text archive of biomedical and life-sciences literature, via NCBI's public API."
                />
                <SourceInfo
                  name="Zenodo"
                  desc="CERN's free open-access repository for datasets, software, and preprints — also where this platform's own linked datasets live."
                />
                <SourceInfo
                  name="CORE"
                  desc="The world's largest aggregator of open-access research. Its search API needs a free, self-service key — search it directly for now."
                  href="https://core.ac.uk/search"
                />
                <SourceInfo
                  name="BASE"
                  desc="Bielefeld Academic Search Engine — one of the world's largest OA indexes. Its search API requires a registered access agreement — search it directly."
                  href="https://www.base-search.net/Search/Advanced"
                />
                <SourceInfo
                  name="OER Commons"
                  desc="A free library of open educational resources (courses, lesson plans, textbooks) from ISKME — no public search API to integrate against."
                  href="https://www.oercommons.org/search"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}

function ComingSoonNotice({ text, kind }: { text: string; kind: "trainings" | "webinars" }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="paper-card border-dashed">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
        <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={() => setOpen(true)}>
          <Mail className="mr-2 h-3.5 w-3.5" /> Suggest a topic
        </Button>
        {/* Mounted only while open, so each opening starts from a fresh form. */}
        {open && <SuggestTopicDialog kind={kind} open onOpenChange={setOpen} />}
      </CardContent>
    </Card>
  );
}

/** Sends a training/webinar topic suggestion to the official editorial inbox. */
function SuggestTopicDialog({ kind, open, onOpenChange }: { kind: "trainings" | "webinars"; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useApp();
  const [form, setForm] = useState({ name: user?.fullName ?? "", email: user?.email ?? "", topic: "", details: "", website: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const label = kind === "webinars" ? "webinar" : "training or course";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await apiFetch("/api/resources/suggest-topic", { method: "POST", body: JSON.stringify({ kind, ...form }) });
      setSent(true);
      setForm((f) => ({ ...f, topic: "", details: "" }));
    } catch (err: any) {
      toast.error("Could not send your suggestion", { description: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Suggest a {label} topic</DialogTitle>
          <DialogDescription>Your suggestion goes straight to the editorial office by email. We may reply to ask more.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <p className="font-medium">Thank you. Your suggestion has been sent.</p>
            <p className="text-sm text-muted-foreground">A confirmation is on its way to {form.email}.</p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`st-name-${kind}`}>Your name</Label>
                <Input id={`st-name-${kind}`} value={form.name} onChange={set("name")} required maxLength={120} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`st-email-${kind}`}>Email</Label>
                <Input id={`st-email-${kind}`} type="email" value={form.email} onChange={set("email")} required maxLength={200} autoComplete="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`st-topic-${kind}`}>Topic</Label>
              <Input id={`st-topic-${kind}`} value={form.topic} onChange={set("topic")} required maxLength={160} placeholder={kind === "webinars" ? "e.g. Writing a strong cover letter to editors" : "e.g. Introduction to systematic reviews"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`st-details-${kind}`}>Details <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id={`st-details-${kind}`} value={form.details} onChange={set("details")} rows={4} maxLength={3000} placeholder="Who is it for, and what should it cover?" />
            </div>
            {/* Honeypot: hidden from people, filled in by bots. */}
            <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send suggestion
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourceInfo({ name, desc, href }: { name: string; desc: string; href?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold">{name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          Search directly <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
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
