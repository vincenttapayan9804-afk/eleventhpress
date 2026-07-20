"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { DISCIPLINE_COLORS } from "@/lib/article";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Layers, ChevronDown, ChevronUp, Plus, Loader2, Search } from "lucide-react";
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

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * Public browse page for editor-curated Special Issues / Collections
 * (GET /api/collections) — thematic bundles of already-published
 * articles, distinct from the journal's sequential Issues. Editors get an
 * inline creation form right on this page rather than a separate
 * dashboard tab, matching how DatasetsSection is self-contained on the
 * article page.
 */
export function CollectionsView() {
  const { openArticle, user } = useApp();
  const [items, setItems] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const isEditor = !!user && EDITOR_ROLES.includes(user.role);

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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div>
          <p className="eyebrow">Special issues</p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Collections</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Editor-curated thematic bundles of published articles, spanning any issue or volume.
          </p>
        </div>
        {isEditor && (
          <Button variant="outline" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" /> New collection
          </Button>
        )}
      </div>

      {isEditor && showCreate && <CreateCollectionForm onCreated={() => { setShowCreate(false); load(); }} />}

      {loading ? (
        <div className="mt-10 grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 shimmer rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Layers className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No collections have been published yet.</p>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
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
    <Card className="paper-card mt-6">
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
