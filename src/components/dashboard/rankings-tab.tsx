"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Trophy } from "lucide-react";

interface InstitutionRanking {
  tenantId: string;
  name: string;
  slug: string;
  isPlatform: boolean;
  articleCount: number;
  totalViews: number;
  totalDownloads: number;
  totalShares: number;
  totalCitations: number;
  avgCitationsPerArticle: number;
}

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: "citations", label: "Citations" },
  { key: "views", label: "Views" },
  { key: "downloads", label: "Downloads" },
  { key: "shares", label: "Shares" },
  { key: "articles", label: "Articles" },
];

/**
 * EP University OS Phase 5 — SUPER_ADMIN-only cross-tenant institutional
 * ranking, live-computed from published Article counters via
 * GET /api/admin/rankings/institutions. No snapshot history — the table
 * always reflects current totals, same posture as the COUNTER SUSHI
 * reports (CounterTab) it reuses the underlying counters from.
 */
export function RankingsTab() {
  const [rows, setRows] = useState<InstitutionRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("citations");

  async function load(sort: string) {
    setLoading(true);
    try {
      const res = await apiFetch<{ rankings: InstitutionRanking[] }>(`/api/admin/rankings/institutions?sortBy=${sort}`);
      setRows(res.rankings);
    } catch (e: any) {
      toast.error(e.message || "Failed to load institutional rankings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(sortBy);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <p className="eyebrow">Institutional rankings — {rows.length} tenant{rows.length === 1 ? "" : "s"}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  type="button"
                  size="sm"
                  variant={sortBy === opt.key ? "default" : "outline"}
                  onClick={() => {
                    setSortBy(opt.key);
                    load(opt.key);
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Computed live from published articles across every tenant. Platform-level view — not visible to tenant admins.
          </p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tenants found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Institution</th>
                    <th className="py-2 pr-4 text-right">Articles</th>
                    <th className="py-2 pr-4 text-right">Views</th>
                    <th className="py-2 pr-4 text-right">Downloads</th>
                    <th className="py-2 pr-4 text-right">Shares</th>
                    <th className="py-2 pr-4 text-right">Citations</th>
                    <th className="py-2 pr-4 text-right">Avg cites/article</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.tenantId} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{r.name}</span>
                        {r.isPlatform && (
                          <Badge variant="outline" className="ml-2 text-[0.6rem]">
                            Platform
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">{r.articleCount}</td>
                      <td className="py-2 pr-4 text-right">{r.totalViews.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right">{r.totalDownloads.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right">{r.totalShares.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{r.totalCitations.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right">{r.avgCitationsPerArticle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
