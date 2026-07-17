"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import type { DiscoveryResult, DiscoverySource } from "@/lib/open-discovery";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOI_REGISTRAR } from "@/lib/site";
import { BLOGS, GUIDES, BOOKS, TRAININGS, WEBINARS, type Reading, type Guide, type Planned } from "@/lib/resources-content";
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
  Globe2,
  Search,
  ExternalLink,
  Loader2,
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
  kind: "guide" | "blog" | "training" | "webinar" | "book";
  title: string;
  description: string;
}

const RESOURCE_KIND_LABEL: Record<ResourceSearchHit["kind"], string> = {
  guide: "Guide",
  blog: "Blog",
  training: "Training",
  webinar: "Webinar",
  book: "Book",
};

export function ResourcesView() {
  const t = useTranslations("resources");
  const [tab, setTab] = useState("trainings");
  const [openBlog, setOpenBlog] = useState<Reading | null>(null);
  const [openGuide, setOpenGuide] = useState<Guide | null>(null);

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
        .then((r) => setResourceHits(r.results))
        .catch(() => setResourceHits([]))
        .finally(() => setResourceSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [resourceQuery]);

  function openResourceHit(hit: ResourceSearchHit) {
    if (hit.kind === "guide") {
      const guide = GUIDES.find((g) => g.id === hit.id);
      if (guide) setOpenGuide(guide);
    } else if (hit.kind === "blog") {
      const blog = BLOGS.find((b) => b.id === hit.id);
      if (blog) setOpenBlog(blog);
    } else {
      setTab(hit.kind === "training" ? "trainings" : hit.kind === "webinar" ? "webinars" : "books");
    }
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
            placeholder="Search guides, blogs, trainings, webinars, books…"
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
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
          <TabsTrigger value="discover">
            <Globe2 className="mr-1.5 h-3.5 w-3.5" /> {t("tabDiscover")}
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
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/85 text-justify">
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
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/85 text-justify">
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
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[oklch(0.42_0.18_295)]"
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
