"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  ShieldAlert,
  AlertCircle,
  Info,
  Copy,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Tag,
} from "lucide-react";

interface SimilarityMatch {
  articleId: string;
  title: string;
  score: number;
}

interface StatisticalFlag {
  flag: string;
  severity: "info" | "warning" | "concern";
  explanation: string;
}

interface ReferenceItem {
  id: string;
  rawText: string;
  status: "PENDING" | "VALID" | "NOT_FOUND" | "AMBIGUOUS";
  doi: string | null;
  resolvedTitle: string | null;
}

interface Props {
  articleId: string;
}

export function ManuscriptChecksPanel({ articleId }: Props) {
  const [similarity, setSimilarity] = useState<{ score: number; matches: SimilarityMatch[] } | null>(null);
  const [statistical, setStatistical] = useState<{ flags: StatisticalFlag[] } | null>(null);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [aiAssist, setAiAssist] = useState<{ laySummary: string; suggestedKeywords: string[]; mode: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ score: number; matches: SimilarityMatch[] }>(`/api/articles/${articleId}/checks/similarity`)
      .then(setSimilarity)
      .catch(() => setSimilarity(null));
    apiFetch<{ flags: StatisticalFlag[] }>(`/api/articles/${articleId}/checks/statistical`)
      .then(setStatistical)
      .catch(() => setStatistical(null));
    apiFetch<{ references: ReferenceItem[] }>(`/api/articles/${articleId}/references`)
      .then((r) => setReferences(r.references || []))
      .catch(() => setReferences([]));
  }, [articleId]);

  async function runSimilarity() {
    setLoading("similarity");
    try {
      const r = await apiFetch<{ score: number; matches: SimilarityMatch[] }>(
        `/api/articles/${articleId}/checks/similarity`,
        { method: "POST" }
      );
      setSimilarity(r);
      toast.success("Similarity check complete");
    } catch (e: any) {
      toast.error("Similarity check failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  async function runStatistical() {
    setLoading("statistical");
    try {
      const r = await apiFetch<{ flags: StatisticalFlag[]; mode: string }>(
        `/api/articles/${articleId}/checks/statistical`,
        { method: "POST" }
      );
      setStatistical(r);
      toast.success("Statistical sanity check complete", {
        description: r.mode === "heuristic" ? "Heuristic analysis (LLM unavailable)" : "LLM analysis",
      });
    } catch (e: any) {
      toast.error("Statistical check failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  async function runAiAssist() {
    setLoading("ai-assist");
    try {
      const r = await apiFetch<{ laySummary: string; suggestedKeywords: string[]; mode: string }>(
        `/api/articles/${articleId}/ai-assist`,
        { method: "POST" }
      );
      setAiAssist(r);
      toast.success("AI lay summary + keywords generated", {
        description: r.mode === "heuristic" ? "Heuristic analysis (LLM unavailable)" : "LLM analysis",
      });
    } catch (e: any) {
      toast.error("AI assist failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  async function validateReferences() {
    setLoading("references");
    try {
      const r = await apiFetch<{ references: ReferenceItem[] }>(
        `/api/articles/${articleId}/references/validate`,
        { method: "POST" }
      );
      setReferences(r.references || []);
      toast.success("Reference validation complete");
    } catch (e: any) {
      toast.error("Reference validation failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  const scoreColor =
    similarity && similarity.score >= 40
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : similarity && similarity.score >= 15
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3">
        <p className="eyebrow flex items-center gap-1.5">
          <ShieldAlert className="h-3 w-3" /> Manuscript checks
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          In-corpus similarity, statistical sanity, and reference validation.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Similarity */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><Copy className="h-3 w-3" /> In-corpus similarity</p>
            <Button size="sm" variant="outline" onClick={runSimilarity} disabled={loading === "similarity"}>
              {loading === "similarity" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          {similarity ? (
            <div className={`mt-2 rounded-md border p-2 text-xs ${scoreColor}`}>
              <p className="font-medium">{similarity.score}% max similarity to existing corpus</p>
              {similarity.matches?.length > 0 && (
                <ul className="mt-1 space-y-0.5 opacity-90">
                  {similarity.matches.map((m) => (
                    <li key={m.articleId}>{m.score}% — {m.title}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not yet run.</p>
          )}
        </div>

        <Separator />

        {/* AI lay summary + keywords */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI lay summary + keywords</p>
            <Button size="sm" variant="outline" onClick={runAiAssist} disabled={loading === "ai-assist"}>
              {loading === "ai-assist" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          {aiAssist ? (
            <div className="mt-2 space-y-2">
              <p className="rounded-md border border-border p-2 text-xs text-foreground/85">{aiAssist.laySummary}</p>
              {aiAssist.suggestedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiAssist.suggestedKeywords.map((k) => (
                    <Badge key={k} variant="secondary" className="gap-1 text-[0.6rem]">
                      <Tag className="h-2.5 w-2.5" /> {k}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not yet generated.</p>
          )}
        </div>

        <Separator />

        {/* Statistical sanity */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Statistical sanity</p>
            <Button size="sm" variant="outline" onClick={runStatistical} disabled={loading === "statistical"}>
              {loading === "statistical" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          {statistical ? (
            statistical.flags.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {statistical.flags.map((f, i) => (
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
            ) : (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> No red flags detected.
              </p>
            )
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not yet run.</p>
          )}
        </div>

        {/* References */}
        {references.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between">
                <p className="eyebrow flex items-center gap-1"><BookOpen className="h-3 w-3" /> References ({references.length})</p>
                <Button size="sm" variant="outline" onClick={validateReferences} disabled={loading === "references"}>
                  {loading === "references" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </Button>
              </div>
              <div className="mt-2 space-y-1">
                {references.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-xs">
                    <div className="min-w-0 flex-1 break-words">{r.rawText}</div>
                    <Badge
                      variant="outline"
                      className={`text-[0.55rem] ${
                        r.status === "VALID"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : r.status === "NOT_FOUND"
                          ? "border-rose-300 bg-rose-50 text-rose-700"
                          : r.status === "AMBIGUOUS"
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-stone-300 bg-stone-100 text-stone-700"
                      }`}
                    >
                      {r.status.toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
