"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  Star,
  AlertCircle,
  CheckCircle2,
  Info,
  Users,
  ShieldAlert,
  Brain,
  RefreshCw,
} from "lucide-react";

interface TriageReport {
  articleId: string;
  scopeFitScore: number;
  scopeFitReason: string;
  methodologyFlags: any[];
  suggestedReviewers: any[];
  recommendedReviewModel: string;
  summary: string;
  predictedImpact: number;
  riskFlags: any[];
  model: string;
  createdAt: string;
}

interface Props {
  articleId: string;
}

export function TriagePanel({ articleId }: Props) {
  const [report, setReport] = useState<TriageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    try {
      const r = await apiFetch<TriageReport>(`/api/triage?articleId=${articleId}`);
      setReport(r);
      setError(null);
    } catch {
      setReport(null);
    }
  }

  async function runTriage() {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<TriageReport>("/api/triage", {
        method: "POST",
        body: JSON.stringify({ articleId }),
      });
      setReport(r);
      toast.success("Editorial triage complete", {
        description: r.model === "heuristic-fallback" ? "Heuristic analysis (LLM unavailable)" : `LLM analysis via ${r.model}`,
      });
    } catch (e: any) {
      setError(e.message);
      toast.error("Triage failed", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  // Load on mount
  useState(() => {
    loadReport();
  });

  if (loading) {
    return (
      <Card className="paper-card">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Running AI editorial triage…</span>
        </CardContent>
      </Card>
    );
  }

  if (!report && !error) {
    return (
      <Card className="paper-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                <Brain className="h-3 w-3" /> AI Editorial Triage
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Run the LLM-assisted triage to get a scope-fit score, methodology flags,
                suggested reviewers, and predicted impact.
              </p>
            </div>
            <Button size="sm" onClick={runTriage} disabled={loading}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Run triage
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !report) {
    return (
      <Card className="paper-card border-rose-200">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm font-medium">Triage error: {error}</p>
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={runTriage}>
            <RefreshCw className="mr-1.5 h-3 w-3" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  const scopeColor = report.scopeFitScore >= 70 ? "emerald" : report.scopeFitScore >= 40 ? "amber" : "rose";
  const scopeBg =
    scopeColor === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
    scopeColor === "amber" ? "bg-amber-50 border-amber-200 text-amber-700" :
    "bg-rose-50 border-rose-200 text-rose-700";

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <Brain className="h-3 w-3" /> AI Editorial Triage
            </p>
            <p className="mt-1 font-display text-base font-semibold">
              {report.model === "heuristic-fallback" ? "Heuristic analysis" : `LLM analysis · ${report.model}`}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={runTriage} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3 w-3" /> Re-run
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scope fit + predicted impact */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-md border p-3 ${scopeBg}`}>
            <p className="text-xs font-medium opacity-80">Scope fit</p>
            <p className="mt-1 font-display text-2xl font-bold">{report.scopeFitScore}<span className="text-sm">/100</span></p>
            <p className="mt-1 text-[0.7rem] opacity-90">{report.scopeFitReason}</p>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-medium text-primary/80">Predicted impact</p>
            <div className="mt-1 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-5 w-5 ${n <= report.predictedImpact ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                />
              ))}
            </div>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Recommended: {report.recommendedReviewModel.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div>
          <p className="eyebrow mb-1">Summary</p>
          <p className="text-xs leading-relaxed text-foreground/85">{report.summary}</p>
        </div>

        <Separator />

        {/* Methodology flags */}
        {report.methodologyFlags?.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Methodology flags</p>
            <div className="space-y-1.5">
              {report.methodologyFlags.map((f, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-border p-2 text-xs">
                  {f.severity === "concern" ? (
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
                  ) : f.severity === "warning" ? (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                  ) : (
                    <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{f.flag}</p>
                    <p className="text-muted-foreground">{f.explanation}</p>
                  </div>
                  <Badge variant="outline" className="text-[0.55rem]">{f.severity}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested reviewers */}
        {report.suggestedReviewers?.length > 0 && (
          <div>
            <p className="eyebrow mb-2 flex items-center gap-1">
              <Users className="h-3 w-3" /> Suggested reviewers
            </p>
            <div className="space-y-1.5">
              {report.suggestedReviewers.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                  <div className="flex-1">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-muted-foreground">{r.reason}</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[0.6rem]">
                    {r.matchScore}% match
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk flags */}
        {report.riskFlags?.length > 0 && (
          <div>
            <p className="eyebrow mb-1">Risk flags</p>
            <div className="flex flex-wrap gap-1.5">
              {report.riskFlags.map((flag, i) => (
                <Badge key={i} variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 text-[0.6rem]">
                  <AlertCircle className="mr-1 h-2.5 w-2.5" /> {flag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
