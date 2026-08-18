"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scale } from "lucide-react";

interface TenantResearchMetrics {
  tenantId: string;
  publications: number;
  citations: number;
  avgCitationsPerArticle: number;
  collaborativeArticles: number;
  researchAreas: number;
  fundingTotal: number;
  grantCount: number;
  patentCount: number;
  datasetCount: number;
  internationalReach: number;
  activeResearchers: number;
  researcherProductivity: number;
}

interface PeerAggregate {
  band: { key: string; label: string };
  peerCount: number;
  medianCitations: number;
  medianFundingTotal: number;
  medianPatentCount: number;
  medianDatasetCount: number;
  medianInternationalReach: number;
  medianResearcherProductivity: number;
  avgCollaborativeArticleRatio: number;
}

interface BenchmarkResult {
  own: TenantResearchMetrics;
  peers: PeerAggregate;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function Row({ label, own, peer, ownFmt, peerFmt }: { label: string; own: number; peer: number; ownFmt?: (n: number) => string; peerFmt?: (n: number) => string }) {
  const format = ownFmt ?? ((n: number) => n.toLocaleString());
  const peerFormat = peerFmt ?? format;
  const ahead = own > peer;
  const behind = own < peer;
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-4 text-sm">{label}</td>
      <td className="py-2 pr-4 text-right text-sm font-semibold">{format(own)}</td>
      <td className="py-2 pr-4 text-right text-sm text-muted-foreground">{peerFormat(peer)}</td>
      <td className="py-2 pr-4 text-right">
        {ahead && (
          <Badge variant="outline" className="text-[0.6rem] text-emerald-600">
            Above peer median
          </Badge>
        )}
        {behind && (
          <Badge variant="outline" className="text-[0.6rem] text-amber-600">
            Below peer median
          </Badge>
        )}
        {!ahead && !behind && (
          <Badge variant="outline" className="text-[0.6rem] text-muted-foreground">
            At median
          </Badge>
        )}
      </td>
    </tr>
  );
}

/**
 * Executive Command Intelligence Phase 1 — Research Benchmarking.
 * "How does our research ecosystem compare with institutions of similar
 * size?" Every number is a live count from GET /api/admin/benchmarking;
 * peer figures are a band median/aggregate only, never another tenant's
 * raw identifiable data (see research-benchmark.ts).
 */
export function BenchmarkingTab() {
  const [data, setData] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BenchmarkResult>("/api/admin/benchmarking")
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load benchmarking data"));
  }, []);

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

  const { own, peers } = data;

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow flex items-center gap-1.5">
          <Scale className="h-3 w-3" /> Research Benchmarking
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your ecosystem compared with {peers.peerCount} institution{peers.peerCount === 1 ? "" : "s"} in the{" "}
          <span className="font-medium text-foreground">{peers.band.label}</span> peer band — every figure is a live count, and peer
          numbers shown are the band's median, never another institution's raw data.
        </p>
      </div>

      <Card className="paper-card">
        <CardHeader className="pb-2">
          <p className="text-xs font-medium">You vs. peer median</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Metric</th>
                  <th className="py-2 pr-4 text-right">You</th>
                  <th className="py-2 pr-4 text-right">Peer median</th>
                  <th className="py-2 pr-4 text-right">Standing</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Citations" own={own.citations} peer={peers.medianCitations} />
                <Row label="Funding (Grant total, mixed currency)" own={own.fundingTotal} peer={peers.medianFundingTotal} ownFmt={fmtCurrency} peerFmt={fmtCurrency} />
                <Row label="Patents" own={own.patentCount} peer={peers.medianPatentCount} />
                <Row label="Open datasets" own={own.datasetCount} peer={peers.medianDatasetCount} />
                <Row label="International reach (author countries)" own={own.internationalReach} peer={peers.medianInternationalReach} />
                <Row label="Researcher productivity (pubs/researcher)" own={own.researcherProductivity} peer={peers.medianResearcherProductivity} />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="paper-card">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Publications</p>
            <p className="mt-1 text-lg font-semibold">{own.publications}</p>
            <p className="text-[0.65rem] text-muted-foreground">avg {own.avgCitationsPerArticle} citations/article</p>
          </CardContent>
        </Card>
        <Card className="paper-card">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Research areas</p>
            <p className="mt-1 text-lg font-semibold">{own.researchAreas}</p>
            <p className="text-[0.65rem] text-muted-foreground">distinct disciplines published</p>
          </CardContent>
        </Card>
        <Card className="paper-card">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Collaboration</p>
            <p className="mt-1 text-lg font-semibold">
              {own.publications > 0 ? Math.round((own.collaborativeArticles / own.publications) * 100) : 0}%
            </p>
            <p className="text-[0.65rem] text-muted-foreground">
              of articles multi-authored, vs. {Math.round(peers.avgCollaborativeArticleRatio * 100)}% peer average
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
