"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Gavel } from "lucide-react";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface DecisionTypeCount {
  decision: string;
  count: number;
}

interface DecisionFunnel {
  total: number;
  byType: DecisionTypeCount[];
  acceptRate: number;
  revisionRate: number;
}

interface BoardComposition {
  distinctEditorCount: number;
  activeEditorCount: number;
}

interface TimelinessSummary {
  avgDaysToFirstDecision: number | null;
  awaitingFirstDecisionCount: number;
  avgDaysAwaitingFirstDecision: number | null;
}

interface CaseloadBucket {
  label: string;
  editorCount: number;
}

interface CaseloadDistribution {
  buckets: CaseloadBucket[];
  overloadedEditorCount: number;
  unassignedActiveCount: number;
}

interface ResearchBoardIntelligenceResult {
  composition: BoardComposition;
  funnel: DecisionFunnel;
  timeliness: TimelinessSummary;
  caseload: CaseloadDistribution;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const DECISION_LABELS: Record<string, string> = {
  ASSIGN_REVIEWERS: "Assign reviewers",
  REQUEST_REVISIONS: "Request revisions",
  ACCEPT: "Accept",
  REJECT: "Reject",
  SEND_TO_PRODUCTION: "Send to production",
};

const MAX_BUCKET_BAR = 1; // relative width baseline, computed against the largest bucket at render time

/**
 * Executive Command Intelligence — "Research Board Intelligence" (Phase 5
 * of 5, in the sidebar's "Executive Command Intelligence" group — the
 * final phase). Phases 1-4 look at outputs, trends, reputation, and
 * reviewer capacity; Phase 5 turns to the editorial board itself: how
 * many editors are active, how fast a first decision lands, the
 * accept/reject/revision mix, and whether the current active caseload is
 * evenly spread. Built from GET /api/admin/research-board. Deliberately
 * no per-editor naming or leaderboard (board capacity planning, not a
 * performance review) and no fabricated composite "board health score."
 *
 * Same SUPER_ADMIN/TENANT_ADMIN tenantId asymmetry as Phases 1-4.
 */
export function ResearchBoardTab({ role }: { role: string }) {
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [data, setData] = useState<ResearchBoardIntelligenceResult | null>(null);
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
    apiFetch<ResearchBoardIntelligenceResult>("/api/admin/research-board")
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load research board data"));
  }, [isSuperAdmin]);

  function selectTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
    setData(null);
    setError(null);
    if (!tenantId) return;
    apiFetch<ResearchBoardIntelligenceResult>(`/api/admin/research-board?tenantId=${tenantId}`)
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load research board data"));
  }

  const header = (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Executive Command Intelligence · Phase 5 of 5</p>
      <p className="eyebrow mt-1 flex items-center gap-1.5">
        <Gavel className="h-3 w-3" /> Research Board Intelligence
      </p>
    </div>
  );

  if (isSuperAdmin && !selectedTenantId) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-sm text-muted-foreground">Pick an institution to build its editorial board snapshot.</p>
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

  const { composition, funnel, timeliness, caseload } = data;
  const maxBucket = Math.max(MAX_BUCKET_BAR, ...caseload.buckets.map((b) => b.editorCount));

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

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Board composition & decision funnel</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-sm">
              <span className="font-semibold">{composition.distinctEditorCount.toLocaleString()}</span>{" "}
              <span className="text-muted-foreground">editors have ever made a decision, {composition.activeEditorCount.toLocaleString()} active in the last 90 days</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {funnel.byType.length === 0 ? (
                <span className="text-xs text-muted-foreground">No editorial decisions recorded yet.</span>
              ) : (
                funnel.byType.map((t) => (
                  <Badge key={t.decision} variant="outline" className="text-[0.65rem]">
                    {t.count} {DECISION_LABELS[t.decision] ?? t.decision.toLowerCase()}
                  </Badge>
                ))
              )}
            </div>
            <p className="text-sm">
              <span className="font-semibold">{fmtPct(funnel.acceptRate)}</span> <span className="text-muted-foreground">accept rate (of accept/reject)</span>
              {" · "}
              <span className="font-semibold">{fmtPct(funnel.revisionRate)}</span> <span className="text-muted-foreground">of all decisions request revisions</span>
            </p>
          </CardContent>
        </Card>

        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Timeliness</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-sm">
              {timeliness.avgDaysToFirstDecision === null ? (
                <span className="text-muted-foreground">No decided articles with a submission date yet.</span>
              ) : (
                <>
                  <span className="font-semibold">{timeliness.avgDaysToFirstDecision}</span>{" "}
                  <span className="text-muted-foreground">avg. days from submission to first editorial decision</span>
                </>
              )}
            </p>
            <p className="text-sm">
              <span className="font-semibold">{timeliness.awaitingFirstDecisionCount.toLocaleString()}</span>{" "}
              <span className="text-muted-foreground">articles still awaiting a first decision</span>
              {timeliness.avgDaysAwaitingFirstDecision !== null && (
                <>
                  {" "}
                  <span className="text-muted-foreground">(avg. {timeliness.avgDaysAwaitingFirstDecision} days waiting so far)</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="paper-card">
        <CardHeader className="pb-2">
          <p className="text-xs font-medium">Active caseload distribution</p>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-2 text-xs text-muted-foreground">
            Active (submitted/under review/revisions-required) articles per editor of record.{" "}
            {caseload.overloadedEditorCount > 0 && <span className="text-amber-600">{caseload.overloadedEditorCount} carrying 5 or more.</span>}
            {caseload.unassignedActiveCount > 0 && (
              <span className="text-amber-600"> {caseload.unassignedActiveCount} active article(s) have no decision yet, so no editor of record.</span>
            )}
          </p>
          <div className="space-y-1.5">
            {caseload.buckets.map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-xs">
                <span className="w-10 font-medium">{b.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(b.editorCount / maxBucket) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{b.editorCount}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
