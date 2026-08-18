"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Presentation } from "lucide-react";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface BoardHeadline {
  publications: number;
  citations: number;
  fundingTotal: number;
  activeGrants: number;
  patentCount: number;
  activeResearchers: number;
}

interface QuarterPoint {
  period: string;
  count: number;
}

interface FundingQuarterPoint {
  period: string;
  amount: number;
}

interface DisciplineShare {
  discipline: string;
  count: number;
}

interface EthicsCompliance {
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
  avgTurnaroundDays: number | null;
}

interface BoardIntelligenceResult {
  headline: BoardHeadline;
  publicationTrend: QuarterPoint[];
  fundingTrend: FundingQuarterPoint[];
  topDisciplines: DisciplineShare[];
  ethicsCompliance: EthicsCompliance;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function TrendBars({ points, format }: { points: { period: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="space-y-1.5">
      {points.map((p) => (
        <div key={p.period} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-muted-foreground">{p.period}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(p.value / max) * 100}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right font-medium">{format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Executive Command Intelligence — the "Board-Level Research Intelligence"
 * sub-section (Phase 2 of 5, in the sidebar's "Executive Command
 * Intelligence" group). "How is our research enterprise trending, and
 * where are the compliance risks?" — a board-meeting-ready snapshot built
 * from GET /api/admin/board-intelligence: headline totals, quarterly
 * publication/funding trends, top disciplines, and ethics/IRB compliance
 * turnaround. One tenant's own real numbers only — never a comparison
 * across tenants (that's Phase 1's job).
 *
 * Same SUPER_ADMIN/TENANT_ADMIN tenantId asymmetry as Phase 1's
 * benchmarking route: TENANT_ADMIN's tenant is implicit from the session,
 * SUPER_ADMIN has none of its own and must pick one, so SUPER_ADMIN gets
 * the same institution picker pattern instead of an unconditional fetch.
 */
export function BoardIntelligenceTab({ role }: { role: string }) {
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [data, setData] = useState<BoardIntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");

  useEffect(() => {
    if (isSuperAdmin) {
      apiFetch<{ tenants: TenantOption[] }>("/api/admin/tenants")
        .then((res) => setTenants(res.tenants))
        .catch((e: any) => setError(e.message || "Failed to load tenants"));
      return;
    }
    apiFetch<BoardIntelligenceResult>("/api/admin/board-intelligence")
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load board intelligence data"));
  }, [isSuperAdmin]);

  function selectTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
    setData(null);
    setError(null);
    if (!tenantId) return;
    apiFetch<BoardIntelligenceResult>(`/api/admin/board-intelligence?tenantId=${tenantId}`)
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load board intelligence data"));
  }

  const header = (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Executive Command Intelligence · Phase 2 of 5</p>
      <p className="eyebrow mt-1 flex items-center gap-1.5">
        <Presentation className="h-3 w-3" /> Board-Level Research Intelligence
      </p>
    </div>
  );

  if (isSuperAdmin && !selectedTenantId) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-sm text-muted-foreground">Pick an institution to build its board-level snapshot.</p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <select
          className="border-input h-9 w-full max-w-sm rounded-md border bg-transparent px-3 text-sm shadow-xs"
          value={selectedTenantId}
          onChange={(e) => selectTenant(e.target.value)}
        >
          <option value="">— select an institution —</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  if (!data) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading...
      </p>
    );
  }

  const { headline, publicationTrend, fundingTrend, topDisciplines, ethicsCompliance } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {header}
        {isSuperAdmin && (
          <Button size="sm" variant="outline" onClick={() => selectTenant("")}>
            Change institution
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Publications", value: headline.publications.toLocaleString() },
          { label: "Citations", value: headline.citations.toLocaleString() },
          { label: "Funding (total)", value: fmtCurrency(headline.fundingTotal) },
          { label: "Active grants", value: headline.activeGrants.toLocaleString() },
          { label: "Patents", value: headline.patentCount.toLocaleString() },
          { label: "Active researchers", value: headline.activeResearchers.toLocaleString() },
        ].map((stat) => (
          <Card key={stat.label} className="paper-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-lg font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Publication trend (last 6 quarters)</p>
          </CardHeader>
          <CardContent className="pt-0">
            <TrendBars points={publicationTrend.map((p) => ({ period: p.period, value: p.count }))} format={(n) => n.toLocaleString()} />
          </CardContent>
        </Card>

        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Funding trend (last 6 quarters)</p>
          </CardHeader>
          <CardContent className="pt-0">
            <TrendBars points={fundingTrend.map((p) => ({ period: p.period, value: p.amount }))} format={fmtCurrency} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Top research disciplines</p>
          </CardHeader>
          <CardContent className="pt-0">
            {topDisciplines.length === 0 ? (
              <p className="text-xs text-muted-foreground">No published research yet.</p>
            ) : (
              <TrendBars points={topDisciplines.map((d) => ({ period: d.discipline, value: d.count }))} format={(n) => n.toLocaleString()} />
            )}
          </CardContent>
        </Card>

        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Ethics / IRB compliance</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[0.65rem]">
                {ethicsCompliance.submitted} submitted
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-emerald-600">
                {ethicsCompliance.approved} approved
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-rose-600">
                {ethicsCompliance.rejected} rejected
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-amber-600">
                {ethicsCompliance.pending} pending review
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-semibold">{Math.round(ethicsCompliance.approvalRate * 100)}%</span>{" "}
              <span className="text-muted-foreground">approval rate among decided submissions</span>
            </p>
            <p className="text-sm">
              {ethicsCompliance.avgTurnaroundDays === null ? (
                <span className="text-muted-foreground">No decided submissions yet — turnaround not yet measurable.</span>
              ) : (
                <>
                  <span className="font-semibold">{ethicsCompliance.avgTurnaroundDays}</span>{" "}
                  <span className="text-muted-foreground">avg. days from submission to decision</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
