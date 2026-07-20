"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { DISCIPLINE_COLORS } from "@/lib/article";
import { parseAuthors, STATUS_LABELS } from "@/lib/article";
import type { ArticleStatus } from "@/lib/article";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Layers,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  Search,
  Database,
  ExternalLink,
  FileText,
  Download,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface CollectionSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  publishedAt: string;
  articleCount: number;
}

interface CollectionArticle {
  id: string;
  title: string;
  discipline: string;
  citations: number;
  views: number;
}

interface CollectionDetail extends CollectionSummary {
  articles: CollectionArticle[];
}

interface DatasetRow {
  id: string;
  repository: string;
  datasetDoi: string | null;
  datasetUrl: string;
  datasetTitle: string;
  relationType: string;
  createdAt: string;
  article: { id: string; title: string; discipline: string };
}

interface PreprintRow {
  id: string;
  title: string;
  abstract: string;
  keywords: string;
  discipline: string;
  authors: string;
  status: ArticleStatus;
  preprintPostedAt: string;
}

const RELATION_LABEL: Record<string, string> = {
  isSupplementedBy: "Supplementary data",
  isReferencedBy: "Referenced dataset",
  isSourceOf: "Source dataset",
};

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * Public browse page for Collections, Datasets, and Preprints — three
 * previously separate top-level nav destinations, merged here as tabs of
 * one "Collections" section since all three are ways of browsing content
 * that sits outside the journal's sequential Issues (editor-curated
 * bundles, deposited research data, and pre-review manuscripts). Editors
 * get an inline creation form right on the Collections tab rather than a
 * separate dashboard tab, matching how DatasetsSection is self-contained
 * on the article page.
 */
export function CollectionsView() {
  const { user } = useApp();
  const [tab, setTab] = useState("collections");
  const [showCreate, setShowCreate] = useState(false);
  const isEditor = !!user && EDITOR_ROLES.includes(user.role);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div>
          <p className="eyebrow">Special issues, data &amp; preprints</p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Collections</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Editor-curated thematic bundles, deposited research data, and preprint manuscripts — browse
            by type.
          </p>
        </div>
        {tab === "collections" && isEditor && (
          <Button variant="outline" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" /> New collection
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="collections">
            <Layers className="mr-1.5 h-3.5 w-3.5" /> Collections
          </TabsTrigger>
          <TabsTrigger value="datasets">
            <Database className="mr-1.5 h-3.5 w-3.5" /> Datasets
          </TabsTrigger>
          <TabsTrigger value="preprints">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Preprints
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-6">
          <CollectionsTabPanel
            isEditor={isEditor}
            showCreate={showCreate}
            onCreated={() => { setShowCreate(false); }}
          />
        </TabsContent>

        <TabsContent value="datasets" className="mt-6">
          <DatasetsTabPanel />
        </TabsContent>

        <TabsContent value="preprints" className="mt-6">
          <PreprintsTabPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CollectionsTabPanel({
  isEditor,
  showCreate,
  onCreated,
}: {
  isEditor: boolean;
  showCreate: boolean;
  onCreated: () => void;
}) {
  const { openArticle } = useApp();
  const [items, setItems] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CollectionDetail | null>(null);

  function load() {
    setLoading(true);
    apiFetch<{ items: CollectionSummary[] }>("/api/collections")
      .then(({ items }) => setItems(items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleExpand(c: CollectionSummary) {
    if (expandedId === c.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(c.id);
    try {
      const d = await apiFetch<CollectionDetail>(`/api/collections/${c.id}`);
      setDetail(d);
    } catch {
      setDetail(null);
    }
  }

  return (
    <div>
      {isEditor && showCreate && (
        <CreateCollectionForm onCreated={() => { onCreated(); load(); }} />
      )}

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 shimmer rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Layers className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No collections have been published yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((c) => (
            <Card key={c.id} className="paper-card">
              <CardContent className="p-5">
                <button onClick={() => toggleExpand(c)} className="flex w-full items-start justify-between gap-3 text-left">
                  <div>
                    <h3 className="font-display text-lg font-semibold leading-snug">{c.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {c.articleCount} article{c.articleCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  {expandedId === c.id ? (
                    <ChevronUp className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                </button>

                {expandedId === c.id && (
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    {!detail ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : detail.articles.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No articles in this collection yet.</p>
                    ) : (
                      detail.articles.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => openArticle(a.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 p-3 text-left text-sm hover:border-primary/40"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[a.discipline] ?? ""}`}>
                              {a.discipline}
                            </Badge>
                            <span className="truncate">{a.title}</span>
                          </div>
                          <span className="flex-shrink-0 text-xs text-muted-foreground">{a.citations} citations</span>
                        </button>
                      ))
                    )}
                    {isEditor && detail && (
                      <AddArticleForm
                        collectionId={c.id}
                        existingIds={detail.articles.map((a) => a.id)}
                        onAdded={async () => setDetail(await apiFetch<CollectionDetail>(`/api/collections/${c.id}`))}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateCollectionForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!title.trim() || !description.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/collections", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      toast.success("Collection published");
      setTitle("");
      setDescription("");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="paper-card mb-6">
      <CardContent className="space-y-3 p-5">
        <p className="eyebrow">New collection</p>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          placeholder="Description — what ties these articles together?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={creating || !title.trim() || !description.trim()} onClick={create}>
            {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Publish collection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddArticleForm({
  collectionId,
  existingIds,
  onAdded,
}: {
  collectionId: string;
  existingIds: string[];
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const { items } = await apiFetch<{ items: { id: string; title: string }[] }>(
        `/api/articles?q=${encodeURIComponent(q)}&pageSize=5`
      );
      setResults(items.filter((i) => !existingIds.includes(i.id)));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function add(articleId: string) {
    setAddingId(articleId);
    try {
      await apiFetch(`/api/collections/${collectionId}/articles`, {
        method: "POST",
        body: JSON.stringify({ articleId }),
      });
      setResults((r) => r.filter((a) => a.id !== articleId));
      onAdded();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="mt-2 border-t border-border pt-3">
      <div className="flex gap-2">
        <Input
          placeholder="Search published articles to add…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button size="icon" variant="outline" onClick={search} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {results.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-xs">
              <span className="truncate">{r.title}</span>
              <Button size="sm" variant="ghost" disabled={addingId === r.id} onClick={() => add(r.id)}>
                {addingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Every dataset deposited across the journal (GET /api/datasets, via
 * DatasetLink) — previously datasets were only visible one article at a
 * time (the article page's own DatasetsSection), then briefly had its own
 * top-level nav destination before being folded in here. Real deposits
 * only, paginated.
 */
function DatasetsTabPanel() {
  const { openArticle } = useApp();
  const [items, setItems] = useState<DatasetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    apiFetch<{ items: DatasetRow[]; total: number }>(`/api/datasets?page=${page}&pageSize=${pageSize}`)
      .then(({ items, total }) => {
        setItems(items);
        setTotal(total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Research data deposited alongside this journal&apos;s published articles — real Zenodo/OSF/Dryad
        deposits, each linked back to the article it supports.
      </p>

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 shimmer rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Database className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No datasets have been deposited yet.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {items.map((d) => (
              <Card key={d.id} className="paper-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="border-[oklch(0.76_0.11_294/0.3)] bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)]">
                      {d.repository}
                    </Badge>
                    <Badge variant="secondary" className="text-[0.65rem]">
                      {RELATION_LABEL[d.relationType] || d.relationType}
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold leading-snug">{d.datasetTitle}</h3>
                  <button
                    onClick={() => openArticle(d.article.id)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                  >
                    <FileText className="h-3 w-3" /> {d.article.title}
                  </button>
                  <div className="mt-4 flex items-center gap-3">
                    <Button size="sm" variant="outline" asChild>
                      <a href={d.datasetUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View dataset
                      </a>
                    </Button>
                    {d.datasetDoi && (
                      <a
                        href={`https://doi.org/${d.datasetDoi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[0.65rem] text-muted-foreground hover:text-primary"
                      >
                        {d.datasetDoi}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Manuscripts posted as preprints (GET /api/preprints — Article.isPreprint,
 * toggled from the author's "My articles" tab). A preprint is explicitly
 * NOT yet peer reviewed — every card carries that notice up front, never
 * presented alongside peer-reviewed PUBLISHED work in a way a reader
 * could conflate the two.
 */
function PreprintsTabPanel() {
  const [items, setItems] = useState<PreprintRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    apiFetch<{ items: PreprintRow[]; total: number }>(`/api/preprints?page=${page}&pageSize=${pageSize}`)
      .then(({ items, total }) => {
        setItems(items);
        setTotal(total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  async function download(id: string) {
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/preprints/${id}/download`);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error("Manuscript not available", { description: e.message });
    }
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Manuscripts an author has chosen to share publicly before or during peer review. These have
        not yet been peer reviewed — treat their findings as preliminary.
      </p>

      {loading ? (
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 shimmer rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No preprints are posted right now.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {items.map((p) => {
              const authors = parseAuthors(p.authors);
              return (
                <Card key={p.id} className="paper-card">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[p.discipline] ?? ""}`}>
                        {p.discipline}
                      </Badge>
                      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> Not yet peer reviewed · {STATUS_LABELS[p.status]}
                      </Badge>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" /> Posted {new Date(p.preprintPostedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{p.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {authors.map((a) => a.name).join(", ")}
                    </p>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.abstract}</p>
                    <Button size="sm" variant="outline" className="mt-4" onClick={() => download(p.id)}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Download preprint manuscript
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
