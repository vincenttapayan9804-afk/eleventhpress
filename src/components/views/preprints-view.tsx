"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { parseAuthors, STATUS_LABELS, DISCIPLINE_COLORS } from "@/lib/article";
import type { ArticleStatus } from "@/lib/article";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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

/**
 * Public browse page for manuscripts posted as preprints
 * (GET /api/preprints — Article.isPreprint, toggled from the author's
 * "My articles" tab). A preprint is explicitly NOT yet peer reviewed —
 * every card carries that notice up front, never presented alongside
 * peer-reviewed PUBLISHED work in a way a reader could conflate the two.
 */
export function PreprintsView() {
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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Preprints</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Preprints</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Manuscripts an author has chosen to share publicly before or during peer review. These have
          not yet been peer reviewed — treat their findings as preliminary.
        </p>
      </div>

      {loading ? (
        <div className="mt-10 grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 shimmer rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No preprints are posted right now.</p>
        </div>
      ) : (
        <>
          <div className="mt-10 space-y-4">
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
