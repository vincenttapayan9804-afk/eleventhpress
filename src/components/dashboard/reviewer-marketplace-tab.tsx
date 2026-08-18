"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users2 } from "lucide-react";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface InvitationFunnel {
  invited: number;
  accepted: number;
  declined: number;
  inProgress: number;
  completed: number;
  responseRate: number;
  declineRate: number;
  completionRate: number;
}

interface WorkloadBucket {
  label: string;
  reviewerCount: number;
}

interface WorkloadDistribution {
  buckets: WorkloadBucket[];
  overloadedReviewerCount: number;
}

interface TimelinessSummary {
  overdueCount: number;
  onTimeCompletionRate: number | null;
}

interface ExpertiseKeyword {
  keyword: string;
  reviewerCount: number;
}

interface ExpertiseCoverage {
  distinctKeywordCount: number;
  topKeywords: ExpertiseKeyword[];
}

interface ReviewerMarketplaceResult {
  poolSize: number;
  activeReviewerCount: number;
  funnel: InvitationFunnel;
  workload: WorkloadDistribution;
  timeliness: TimelinessSummary;
  expertise: ExpertiseCoverage;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const MAX_BUCKET_BAR = 1; // relative width baseline, computed against the largest bucket at render time

/**
 * Executive Command Intelligence — "Reviewer Marketplace Intelligence"
 * (Phase 4 of 5, in the sidebar's "Executive Command Intelligence" group).
 * Phases 1-3 look outward/upward (peer comparison, trend/compliance,
 * reputation); Phase 4 turns inward on the two-sided marketplace that
 * makes peer review possible: is the reviewer pool big enough, responsive
 * enough, and evenly loaded to keep the pipeline moving? Built from
 * GET /api/admin/reviewer-marketplace. Deliberately never renders a single
 * fabricated "marketplace health score" — every number here is a real,
 * live-computed count or rate.
 *
 * Same SUPER_ADMIN/TENANT_ADMIN tenantId asymmetry as Phases 1-3.
 */
export function ReviewerMarketplaceTab({ role }: { role: string }) {
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [data, setData] = useState<ReviewerMarketplaceResult | null>(null);
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
    apiFetch<ReviewerMarketplaceResult>("/api/admin/reviewer-marketplace")
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load reviewer marketplace data"));
  }, [isSuperAdmin]);

  function selectTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
    setData(null);
    setError(null);
    if (!tenantId) return;
    apiFetch<ReviewerMarketplaceResult>(`/api/admin/reviewer-marketplace?tenantId=${tenantId}`)
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load reviewer marketplace data"));
  }

  const header = (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Executive Command Intelligence · Phase 4 of 5</p>
      <p className="eyebrow mt-1 flex items-center gap-1.5">
        <Users2 className="h-3 w-3" /> Reviewer Marketplace Intelligence
      </p>
    </div>
  );

  if (isSuperAdmin && !selectedTenantId) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-sm text-muted-foreground">Pick an institution to build its reviewer marketplace snapshot.</p>
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

  const { poolSize, activeReviewerCount, funnel, workload, timeliness, expertise } = data;
  const maxBucket = Math.max(MAX_BUCKET_BAR, ...workload.buckets.map((b) => b.reviewerCount));
  const maxKeyword = Math.max(MAX_BUCKET_BAR, ...expertise.topKeywords.map((k) => k.reviewerCount));

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
            <p className="text-xs font-medium">Reviewer pool & invitation funnel</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-sm">
              <span className="font-semibold">{poolSize.toLocaleString()}</span>{" "}
              <span className="text-muted-foreground">reviewers ever invited, {activeReviewerCount.toLocaleString()} active in the last 180 days</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[0.65rem]">
                {funnel.invited} invited
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-emerald-600">
                {funnel.accepted} accepted
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-rose-600">
                {funnel.declined} declined
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-amber-600">
                {funnel.inProgress} in progress
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-emerald-600">
                {funnel.completed} completed
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-semibold">{fmtPct(funnel.responseRate)}</span> <span className="text-muted-foreground">response rate</span>
              {" · "}
              <span className="font-semibold">{fmtPct(funnel.declineRate)}</span> <span className="text-muted-foreground">decline rate</span>
              {" · "}
              <span className="font-semibold">{fmtPct(funnel.completionRate)}</span> <span className="text-muted-foreground">completion rate</span>
            </p>
          </CardContent>
        </Card>

        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Timeliness</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-sm">
              <span className="font-semibold">{timeliness.overdueCount.toLocaleString()}</span>{" "}
              <span className="text-muted-foreground">active assignments past their due date</span>
            </p>
            <p className="text-sm">
              {timeliness.onTimeCompletionRate === null ? (
                <span className="text-muted-foreground">No completed reviews with a due date yet.</span>
              ) : (
                <>
                  <span className="font-semibold">{fmtPct(timeliness.onTimeCompletionRate)}</span>{" "}
                  <span className="text-muted-foreground">of completed reviews finished at or before their due date</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Workload distribution</p>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-2 text-xs text-muted-foreground">
              Active (accepted or in-progress) assignments per reviewer.{" "}
              {workload.overloadedReviewerCount > 0 && (
                <span className="text-amber-600">{workload.overloadedReviewerCount} carrying 5 or more.</span>
              )}
            </p>
            <div className="space-y-1.5">
              {workload.buckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-xs">
                  <span className="w-10 font-medium">{b.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(b.reviewerCount / maxBucket) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-muted-foreground">{b.reviewerCount}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Expertise coverage</p>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-2 text-xs text-muted-foreground">{expertise.distinctKeywordCount} distinct expertise keywords across the reviewer pool.</p>
            {expertise.topKeywords.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reviewer expertise on file yet.</p>
            ) : (
              <div className="space-y-1.5">
                {expertise.topKeywords.map((k) => (
                  <div key={k.keyword} className="flex items-center gap-2 text-xs">
                    <span className="w-24 truncate font-medium capitalize">{k.keyword}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(k.reviewerCount / maxKeyword) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-muted-foreground">{k.reviewerCount}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
