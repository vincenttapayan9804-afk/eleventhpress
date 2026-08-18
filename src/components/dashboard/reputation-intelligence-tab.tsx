"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Award } from "lucide-react";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface EditorialRigor {
  submitted: number;
  accepted: number;
  rejected: number;
  underReview: number;
  acceptanceRate: number;
  avgDecisionDays: number | null;
}

interface DirectoryStatusCounts {
  directory: string;
  indexed: number;
  applied: number;
  rejected: number;
  notApplied: number;
}

interface IndexingSummary {
  totalJournals: number;
  directories: DirectoryStatusCounts[];
  indexedListingCount: number;
  totalListingCount: number;
}

interface IntegrityRecord {
  publishedArticles: number;
  normal: number;
  corrected: number;
  underConcern: number;
  retracted: number;
  cleanRecordRate: number;
}

interface ReviewerNetwork {
  distinctReviewers: number;
  completedReviews: number;
  avgReviewerScore: number | null;
  avgReviewTurnaroundDays: number | null;
}

interface ReputationIntelligenceResult {
  editorialRigor: EditorialRigor;
  indexing: IndexingSummary;
  integrity: IntegrityRecord;
  reviewerNetwork: ReviewerNetwork;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtDays(n: number | null): string {
  return n === null ? "—" : `${n} days`;
}

/**
 * Executive Command Intelligence — "Institutional Reputation Intelligence"
 * (Phase 3 of 5, in the sidebar's "Executive Command Intelligence" group).
 * "Is our research enterprise reputable?" — a different lens than Phase 1
 * (peer volume comparison) or Phase 2 (own trend/compliance): editorial
 * rigor, directory/indexing legitimacy, post-publication integrity record,
 * and reviewer network depth. Built from GET /api/admin/reputation-
 * intelligence. Deliberately never renders a single fabricated
 * "reputation score" — every number here is a real, live-computed count
 * or rate.
 *
 * Same SUPER_ADMIN/TENANT_ADMIN tenantId asymmetry as Phases 1-2:
 * TENANT_ADMIN's tenant is implicit from the session, SUPER_ADMIN has none
 * of its own and must pick one via the same institution picker pattern.
 */
export function ReputationIntelligenceTab({ role }: { role: string }) {
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [data, setData] = useState<ReputationIntelligenceResult | null>(null);
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
    apiFetch<ReputationIntelligenceResult>("/api/admin/reputation-intelligence")
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load reputation intelligence data"));
  }, [isSuperAdmin]);

  function selectTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
    setData(null);
    setError(null);
    if (!tenantId) return;
    apiFetch<ReputationIntelligenceResult>(`/api/admin/reputation-intelligence?tenantId=${tenantId}`)
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load reputation intelligence data"));
  }

  const header = (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Executive Command Intelligence · Phase 3 of 5</p>
      <p className="eyebrow mt-1 flex items-center gap-1.5">
        <Award className="h-3 w-3" /> Institutional Reputation Intelligence
      </p>
    </div>
  );

  if (isSuperAdmin && !selectedTenantId) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-sm text-muted-foreground">Pick an institution to build its reputation snapshot.</p>
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

  const { editorialRigor, indexing, integrity, reviewerNetwork } = data;

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
            <p className="text-xs font-medium">Editorial rigor</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[0.65rem]">
                {editorialRigor.submitted} submitted
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-emerald-600">
                {editorialRigor.accepted} accepted
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-rose-600">
                {editorialRigor.rejected} rejected
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-amber-600">
                {editorialRigor.underReview} under review
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-semibold">{fmtPct(editorialRigor.acceptanceRate)}</span>{" "}
              <span className="text-muted-foreground">acceptance rate among decided submissions</span>
            </p>
            <p className="text-sm">
              <span className="font-semibold">{fmtDays(editorialRigor.avgDecisionDays)}</span>{" "}
              <span className="text-muted-foreground">avg. submission-to-decision turnaround</span>
            </p>
          </CardContent>
        </Card>

        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Post-publication integrity record</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[0.65rem] text-emerald-600">
                {integrity.normal} normal
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-amber-600">
                {integrity.corrected} corrected
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-amber-600">
                {integrity.underConcern} under concern
              </Badge>
              <Badge variant="outline" className="text-[0.65rem] text-rose-600">
                {integrity.retracted} retracted
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-semibold">{fmtPct(integrity.cleanRecordRate)}</span>{" "}
              <span className="text-muted-foreground">clean-record rate across {integrity.publishedArticles} published articles</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Directory / indexing coverage</p>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-2 text-xs text-muted-foreground">
              {indexing.indexedListingCount} indexed of {indexing.totalListingCount} listings applied for, across {indexing.totalJournals} journal
              {indexing.totalJournals === 1 ? "" : "s"}.
            </p>
            <div className="space-y-1.5">
              {indexing.directories.map((d) => (
                <div key={d.directory} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{d.directory}</span>
                  <div className="flex gap-1.5">
                    {d.indexed > 0 && (
                      <Badge variant="outline" className="text-[0.6rem] text-emerald-600">
                        {d.indexed} indexed
                      </Badge>
                    )}
                    {d.applied > 0 && (
                      <Badge variant="outline" className="text-[0.6rem] text-amber-600">
                        {d.applied} in progress
                      </Badge>
                    )}
                    {d.rejected > 0 && (
                      <Badge variant="outline" className="text-[0.6rem] text-rose-600">
                        {d.rejected} rejected
                      </Badge>
                    )}
                    {d.indexed === 0 && d.applied === 0 && d.rejected === 0 && <span className="text-muted-foreground">not applied</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="paper-card">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium">Reviewer network</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-sm">
              <span className="font-semibold">{reviewerNetwork.distinctReviewers.toLocaleString()}</span>{" "}
              <span className="text-muted-foreground">distinct reviewers, {reviewerNetwork.completedReviews.toLocaleString()} completed reviews</span>
            </p>
            <p className="text-sm">
              {reviewerNetwork.avgReviewerScore === null ? (
                <span className="text-muted-foreground">No scored reviews yet.</span>
              ) : (
                <>
                  <span className="font-semibold">{reviewerNetwork.avgReviewerScore}/5</span>{" "}
                  <span className="text-muted-foreground">avg. reviewer overall score</span>
                </>
              )}
            </p>
            <p className="text-sm">
              <span className="font-semibold">{fmtDays(reviewerNetwork.avgReviewTurnaroundDays)}</span>{" "}
              <span className="text-muted-foreground">avg. review turnaround</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
