"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LineChart } from "lucide-react";

interface DepartmentRanking {
  departmentId: string | null;
  name: string;
  slug: string;
  tenantId: string | null;
  articleCount: number;
  totalViews: number;
  totalDownloads: number;
  totalShares: number;
  totalCitations: number;
  avgCitationsPerArticle: number;
}

/**
 * EP University OS Phase 5 — comparative research dashboard: how a
 * tenant's own departments compare on published-article output and
 * impact. Visible to TENANT_SCOPED_ADMIN_ROLES (TENANT_ADMIN confined to
 * its own tenant by the API itself; SUPER_ADMIN sees a platform-wide
 * grouping when browsing this tab, since GET /api/admin/rankings/departments
 * omits tenantId in that case). No new schema — reuses Phase 1's
 * Department model and the same published-article counters as RankingsTab.
 */
export function ResearchDashboardTab() {
  const [rows, setRows] = useState<DepartmentRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ rankings: DepartmentRanking[] }>("/api/admin/rankings/departments");
        setRows(res.rankings);
      } catch (e: any) {
        // Errors are surfaced via the empty-state below rather than a toast,
        // matching InstitutionsTab-adjacent read-only tabs' convention.
      } finally {
        setLoading(false);
      }
    })();
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
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-primary" />
            <p className="eyebrow">
              Department comparison — {rows.length} department{rows.length === 1 ? "" : "s"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Computed live from published articles, grouped by each corresponding author's department.
          </p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No departments or published articles found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Department</th>
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
                    <tr key={r.departmentId ?? "unassigned"} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{r.name}</span>
                        {r.departmentId === null && (
                          <Badge variant="outline" className="ml-2 text-[0.6rem]">
                            No department on file
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
