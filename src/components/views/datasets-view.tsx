"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, ExternalLink, Loader2, FileText } from "lucide-react";

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

const RELATION_LABEL: Record<string, string> = {
  isSupplementedBy: "Supplementary data",
  isReferencedBy: "Referenced dataset",
  isSourceOf: "Source dataset",
};

/**
 * Public browse page for every dataset deposited across the journal
 * (GET /api/datasets, src/lib/... via DatasetLink) — previously datasets
 * were only visible one article at a time (the article page's own
 * DatasetsSection). Real deposits only, paginated.
 */
export function DatasetsView() {
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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">Open research data</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Datasets</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Research data deposited alongside this journal&apos;s published articles — real Zenodo/OSF/Dryad
          deposits, each linked back to the article it supports.
        </p>
      </div>

      {loading ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 shimmer rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Database className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No datasets have been deposited yet.</p>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
