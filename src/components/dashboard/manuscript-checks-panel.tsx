"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Info,
  Copy,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Tag,
  ExternalLink,
  ImageIcon,
  Languages,
  SpellCheck2,
  Table2,
  Download,
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

interface StyleFlag {
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

interface IntegrityJob {
  id: string;
  status: "QUEUED" | "SUBMITTED" | "PROCESSING" | "COMPLETED" | "FAILED";
  mode: "live" | "simulation";
  similarityScore: number | null;
  reportUrl: string | null;
  errorMessage: string | null;
  workerLog: string | null;
}

interface AltTextSuggestion {
  src: string;
  existingAlt: string;
  suggestedAlt: string;
  mode: "llm" | "heuristic";
}

interface AltTextJob {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  imagesFound: number;
  results: AltTextSuggestion[];
  appliedAt: string | null;
  errorMessage: string | null;
}

interface TableAccessibilitySuggestion {
  index: number;
  existingCaption: string;
  suggestedCaption: string;
  mode: "llm" | "heuristic";
}

interface TableAccessibilityJob {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  tablesFound: number;
  results: TableAccessibilitySuggestion[];
  appliedAt: string | null;
  errorMessage: string | null;
}

interface TableExtractionResult {
  index: number;
  columns: string[];
  rows: string[][];
  notes: string;
  notesMode: "llm" | "unavailable";
}

interface TableExtractionJob {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  tablesFound: number;
  results: TableExtractionResult[];
  errorMessage: string | null;
}

const TRANSLATION_LOCALES: { code: string; label: string }[] = [
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "fil", label: "Filipino" },
  { code: "zh-Hans", label: "Chinese (Simplified)" },
];

interface Props {
  articleId: string;
}

export function ManuscriptChecksPanel({ articleId }: Props) {
  const [similarity, setSimilarity] = useState<{ score: number; matches: SimilarityMatch[] } | null>(null);
  const [statistical, setStatistical] = useState<{ flags: StatisticalFlag[] } | null>(null);
  const [style, setStyle] = useState<{ flags: StyleFlag[] } | null>(null);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [aiAssist, setAiAssist] = useState<{ laySummary: string; suggestedKeywords: string[]; mode: string } | null>(null);
  const [integrityJob, setIntegrityJob] = useState<IntegrityJob | null>(null);
  const [altTextJob, setAltTextJob] = useState<AltTextJob | null>(null);
  const [editedAlt, setEditedAlt] = useState<Record<string, string>>({});
  const [tableA11yJob, setTableA11yJob] = useState<TableAccessibilityJob | null>(null);
  const [editedCaption, setEditedCaption] = useState<Record<number, string>>({});
  const [tableExtractionJob, setTableExtractionJob] = useState<TableExtractionJob | null>(null);
  const [translations, setTranslations] = useState<Record<string, { mode: string }>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ score: number; matches: SimilarityMatch[] }>(`/api/articles/${articleId}/checks/similarity`)
      .then(setSimilarity)
      .catch(() => setSimilarity(null));
    apiFetch<{ flags: StatisticalFlag[] }>(`/api/articles/${articleId}/checks/statistical`)
      .then(setStatistical)
      .catch(() => setStatistical(null));
    apiFetch<{ flags: StyleFlag[] }>(`/api/articles/${articleId}/checks/style`)
      .then(setStyle)
      .catch(() => setStyle(null));
    apiFetch<{ references: ReferenceItem[] }>(`/api/articles/${articleId}/references`)
      .then((r) => setReferences(r.references || []))
      .catch(() => setReferences([]));
    apiFetch<{ jobs: IntegrityJob[] }>(`/api/articles/${articleId}/integrity-check`)
      .then((r) => setIntegrityJob(r.jobs?.[0] ?? null))
      .catch(() => setIntegrityJob(null));
    apiFetch<{ jobs: AltTextJob[] }>(`/api/articles/${articleId}/alt-text`)
      .then((r) => {
        const latest = r.jobs?.[0] ?? null;
        setAltTextJob(latest);
        if (latest?.results) {
          setEditedAlt(Object.fromEntries(latest.results.map((s) => [s.src, s.suggestedAlt])));
        }
      })
      .catch(() => setAltTextJob(null));
    apiFetch<{ jobs: TableAccessibilityJob[] }>(`/api/articles/${articleId}/table-accessibility`)
      .then((r) => {
        const latest = r.jobs?.[0] ?? null;
        setTableA11yJob(latest);
        if (latest?.results) {
          setEditedCaption(Object.fromEntries(latest.results.map((s) => [s.index, s.suggestedCaption])));
        }
      })
      .catch(() => setTableA11yJob(null));
    apiFetch<{ jobs: TableExtractionJob[] }>(`/api/articles/${articleId}/table-extraction`)
      .then((r) => setTableExtractionJob(r.jobs?.[0] ?? null))
      .catch(() => setTableExtractionJob(null));
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

  async function runIntegrityCheck() {
    setLoading("integrity");
    try {
      const r = await apiFetch<{ success: boolean; deduped?: boolean; job: IntegrityJob }>(
        `/api/articles/${articleId}/integrity-check`,
        { method: "POST" }
      );
      setIntegrityJob(r.job);
      if (r.deduped) {
        toast.info("A check is already in flight for this article");
      } else if (r.job.mode === "simulation") {
        toast.info("iThenticate not configured", {
          description: "Set ITHENTICATE_CLIENT_ID/SECRET to enable a real check — no score was fabricated.",
        });
      } else if (r.job.status === "SUBMITTED") {
        toast.success("Submitted to iThenticate", { description: "The similarity report will arrive via webhook." });
      } else {
        toast.error("Integrity check failed", { description: r.job.errorMessage ?? undefined });
      }
    } catch (e: any) {
      toast.error("Integrity check failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  async function runAltTextGeneration() {
    setLoading("alt-text");
    try {
      const r = await apiFetch<{ success: boolean; deduped?: boolean; job: AltTextJob }>(
        `/api/articles/${articleId}/alt-text`,
        { method: "POST" }
      );
      setAltTextJob(r.job);
      if (r.job.results) {
        setEditedAlt(Object.fromEntries(r.job.results.map((s) => [s.src, s.suggestedAlt])));
      }
      if (r.deduped) {
        toast.info("Alt-text generation already in flight for this article");
      } else if (r.job.status === "COMPLETED") {
        toast.success(`Generated alt text for ${r.job.imagesFound} figure(s)`);
      } else {
        toast.error("Alt-text generation failed", { description: r.job.errorMessage ?? undefined });
      }
    } catch (e: any) {
      toast.error("Alt-text generation failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  async function applyAltText() {
    if (!altTextJob) return;
    setLoading("alt-text-apply");
    try {
      const results = altTextJob.results.map((s) => ({ src: s.src, altText: editedAlt[s.src] ?? s.suggestedAlt }));
      await apiFetch(`/api/articles/${articleId}/alt-text/apply`, {
        method: "POST",
        body: JSON.stringify({ jobId: altTextJob.id, results }),
      });
      setAltTextJob({ ...altTextJob, appliedAt: new Date().toISOString() });
      toast.success("Alt text applied to the published galley");
    } catch (e: any) {
      toast.error("Failed to apply alt text", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  async function runTableAccessibility() {
    setLoading("table-a11y");
    try {
      const r = await apiFetch<{ success: boolean; deduped?: boolean; job: TableAccessibilityJob }>(
        `/api/articles/${articleId}/table-accessibility`,
        { method: "POST" }
      );
      setTableA11yJob(r.job);
      if (r.job.results) {
        setEditedCaption(Object.fromEntries(r.job.results.map((s) => [s.index, s.suggestedCaption])));
      }
      if (r.deduped) {
        toast.info("A table-accessibility check is already in flight for this article");
      } else if (r.job.status === "COMPLETED") {
        toast.success(`Generated caption suggestions for ${r.job.tablesFound} table(s)`);
      } else {
        toast.error("Table accessibility generation failed", { description: r.job.errorMessage ?? undefined });
      }
    } catch (e: any) {
      toast.error("Table accessibility generation failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  async function applyTableAccessibility() {
    if (!tableA11yJob) return;
    setLoading("table-a11y-apply");
    try {
      const results = tableA11yJob.results.map((s) => ({ index: s.index, caption: editedCaption[s.index] ?? s.suggestedCaption }));
      await apiFetch(`/api/articles/${articleId}/table-accessibility/apply`, {
        method: "POST",
        body: JSON.stringify({ jobId: tableA11yJob.id, results }),
      });
      setTableA11yJob({ ...tableA11yJob, appliedAt: new Date().toISOString() });
      toast.success("Captions applied to the published galley");
    } catch (e: any) {
      toast.error("Failed to apply captions", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  async function runTableExtraction() {
    setLoading("table-extraction");
    try {
      const r = await apiFetch<{ success: boolean; deduped?: boolean; job: TableExtractionJob }>(
        `/api/articles/${articleId}/table-extraction`,
        { method: "POST" }
      );
      setTableExtractionJob(r.job);
      if (r.deduped) {
        toast.info("A table-extraction job is already in flight for this article");
      } else if (r.job.status === "COMPLETED") {
        toast.success(`Extracted data from ${r.job.tablesFound} table(s)`);
      } else {
        toast.error("Table extraction failed", { description: r.job.errorMessage ?? undefined });
      }
    } catch (e: any) {
      toast.error("Table extraction failed", { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  function downloadTableCsv(result: TableExtractionResult) {
    const escapeCsv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [result.columns, ...result.rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `table-${result.index + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runTranslate(locale: string) {
    setLoading(`translate-${locale}`);
    try {
      const r = await apiFetch<{ translatedAbstract: string; mode: "llm" | "heuristic"; model: string }>(
        `/api/articles/${articleId}/translate`,
        { method: "POST", body: JSON.stringify({ locale }) }
      );
      setTranslations((prev) => ({ ...prev, [locale]: { mode: r.mode } }));
      if (r.mode === "llm") {
        toast.success(`Abstract translated (${locale})`);
      } else {
        toast.error("Translation unavailable", { description: "LLM unavailable — the English abstract was not overwritten." });
      }
    } catch (e: any) {
      toast.error("Translation failed", { description: e.message });
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

  async function runStyle() {
    setLoading("style");
    try {
      const r = await apiFetch<{ flags: StyleFlag[]; mode: string }>(
        `/api/articles/${articleId}/checks/style`,
        { method: "POST" }
      );
      setStyle(r);
      toast.success("House-style check complete", {
        description: r.mode === "heuristic" ? "Heuristic analysis (LLM unavailable)" : "LLM analysis",
      });
    } catch (e: any) {
      toast.error("Style check failed", { description: e.message });
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
          In-corpus similarity, statistical sanity, house-style consistency, and reference validation.
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

        {/* Enterprise integrity check — a real, additional vendor check
            alongside (not replacing) the in-house similarity screen above.
            Always editor-triggered, never auto-run, since a real submission
            has a genuine per-check cost. */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Enterprise integrity check (iThenticate)</p>
            <Button size="sm" variant="outline" onClick={runIntegrityCheck} disabled={loading === "integrity" || integrityJob?.status === "SUBMITTED"}>
              {loading === "integrity" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
            </Button>
          </div>
          {integrityJob ? (
            <div className="mt-2 rounded-md border border-border p-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[0.55rem]">{integrityJob.mode}</Badge>
                <Badge variant="outline" className="text-[0.55rem]">{integrityJob.status.toLowerCase()}</Badge>
              </div>
              {integrityJob.mode === "simulation" ? (
                <p className="mt-1.5 text-muted-foreground">
                  No score available — set ITHENTICATE_CLIENT_ID/SECRET to enable a real check. Never fabricated.
                </p>
              ) : integrityJob.similarityScore != null ? (
                <>
                  <p className="mt-1.5 font-medium">{integrityJob.similarityScore}% overall match (Turnitin)</p>
                  {integrityJob.reportUrl && (
                    <a href={integrityJob.reportUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> View Similarity Report
                    </a>
                  )}
                </>
              ) : integrityJob.status === "SUBMITTED" ? (
                <p className="mt-1.5 text-muted-foreground">Submitted — awaiting the vendor&apos;s similarity report.</p>
              ) : integrityJob.status === "FAILED" ? (
                <p className="mt-1.5 text-rose-700">{integrityJob.errorMessage}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not yet submitted.</p>
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

        <Separator />

        {/* House-style consistency */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><SpellCheck2 className="h-3 w-3" /> House-style consistency</p>
            <Button size="sm" variant="outline" onClick={runStyle} disabled={loading === "style"}>
              {loading === "style" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          {style ? (
            style.flags.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {style.flags.map((f, i) => (
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
                <CheckCircle2 className="h-3 w-3" /> No inconsistencies detected.
              </p>
            )
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not yet run. Works on articles of any status, including already-published ones.</p>
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

        <Separator />

        {/* Figure alt-text — accessibility. Suggestions are never applied
            automatically; an editor reviews (and may edit) each one, then
            explicitly applies them to the live galley HTML. */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Figure alt-text</p>
            <Button size="sm" variant="outline" onClick={runAltTextGeneration} disabled={loading === "alt-text"}>
              {loading === "alt-text" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
            </Button>
          </div>
          {altTextJob?.status === "COMPLETED" && altTextJob.results.length > 0 ? (
            <div className="mt-2 space-y-2">
              {altTextJob.results.map((s) => (
                <div key={s.src} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-muted-foreground" title={s.src}>{s.src}</p>
                    <Badge variant="outline" className="shrink-0 text-[0.55rem]">{s.mode}</Badge>
                  </div>
                  <Textarea
                    value={editedAlt[s.src] ?? s.suggestedAlt}
                    onChange={(e) => setEditedAlt((prev) => ({ ...prev, [s.src]: e.target.value }))}
                    className="mt-1.5 min-h-14 text-xs"
                    disabled={!!altTextJob.appliedAt}
                  />
                </div>
              ))}
              {altTextJob.appliedAt ? (
                <p className="flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Applied to the published galley.
                </p>
              ) : (
                <Button size="sm" className="w-full" onClick={applyAltText} disabled={loading === "alt-text-apply"}>
                  {loading === "alt-text-apply" ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null} Apply to galley
                </Button>
              )}
            </div>
          ) : altTextJob?.status === "COMPLETED" ? (
            <p className="mt-1 text-xs text-muted-foreground">No figures found in the galley HTML.</p>
          ) : altTextJob?.status === "FAILED" ? (
            <p className="mt-1 text-xs text-rose-700">{altTextJob.errorMessage}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not yet generated.</p>
          )}
        </div>

        <Separator />

        {/* Table accessibility — same never-auto-applied review contract as
            figure alt-text above, committed as a native <caption> element. */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><BookOpen className="h-3 w-3" /> Table accessibility</p>
            <Button size="sm" variant="outline" onClick={runTableAccessibility} disabled={loading === "table-a11y"}>
              {loading === "table-a11y" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
            </Button>
          </div>
          {tableA11yJob?.status === "COMPLETED" && tableA11yJob.results.length > 0 ? (
            <div className="mt-2 space-y-2">
              {tableA11yJob.results.map((s) => (
                <div key={s.index} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground">Table {s.index + 1}</p>
                    <Badge variant="outline" className="shrink-0 text-[0.55rem]">{s.mode}</Badge>
                  </div>
                  <Textarea
                    value={editedCaption[s.index] ?? s.suggestedCaption}
                    onChange={(e) => setEditedCaption((prev) => ({ ...prev, [s.index]: e.target.value }))}
                    className="mt-1.5 min-h-14 text-xs"
                    disabled={!!tableA11yJob.appliedAt}
                  />
                </div>
              ))}
              {tableA11yJob.appliedAt ? (
                <p className="flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Applied to the published galley.
                </p>
              ) : (
                <Button size="sm" className="w-full" onClick={applyTableAccessibility} disabled={loading === "table-a11y-apply"}>
                  {loading === "table-a11y-apply" ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null} Apply to galley
                </Button>
              )}
            </div>
          ) : tableA11yJob?.status === "COMPLETED" ? (
            <p className="mt-1 text-xs text-muted-foreground">No tables found in the galley HTML.</p>
          ) : tableA11yJob?.status === "FAILED" ? (
            <p className="mt-1 text-xs text-rose-700">{tableA11yJob.errorMessage}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not yet generated.</p>
          )}
        </div>

        <Separator />

        {/* Table/dataset extraction — columns/rows are parsed straight out
            of the table's own markup (always real, never an LLM guess);
            the one-sentence "notes" field is a genuine LLM enhancement
            that's simply absent (not faked) when no LLM is available. No
            "apply to galley" here — the output is a downloadable dataset,
            not a galley edit. */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><Table2 className="h-3 w-3" /> Table/dataset extraction</p>
            <Button size="sm" variant="outline" onClick={runTableExtraction} disabled={loading === "table-extraction"}>
              {loading === "table-extraction" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
            </Button>
          </div>
          {tableExtractionJob?.status === "COMPLETED" && tableExtractionJob.results.length > 0 ? (
            <div className="mt-2 space-y-2">
              {tableExtractionJob.results.map((r) => (
                <div key={r.index} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground">
                      Table {r.index + 1} — {r.columns.length} column(s), {r.rows.length} row(s)
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[0.65rem]"
                      onClick={() => downloadTableCsv(r)}
                      disabled={r.rows.length === 0}
                    >
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                  </div>
                  {r.columns.length > 0 && (
                    <p className="mt-1 truncate text-muted-foreground/80" title={r.columns.join(", ")}>
                      Columns: {r.columns.join(", ")}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-start gap-1.5">
                    <Badge variant="outline" className="shrink-0 text-[0.55rem]">{r.notesMode}</Badge>
                    <p className="text-foreground/85">{r.notes || "No summary available — LLM unavailable."}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : tableExtractionJob?.status === "COMPLETED" ? (
            <p className="mt-1 text-xs text-muted-foreground">No tables found in the galley HTML.</p>
          ) : tableExtractionJob?.status === "FAILED" ? (
            <p className="mt-1 text-xs text-rose-700">{tableExtractionJob.errorMessage}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not yet generated.</p>
          )}
        </div>

        <Separator />

        {/* Abstract translation — feeds the site's existing 5-locale i18n.
            Explicitly per-locale, never auto-run for all locales at once. */}
        <div>
          <p className="eyebrow flex items-center gap-1"><Languages className="h-3 w-3" /> Abstract translation</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TRANSLATION_LOCALES.map((l) => {
              const result = translations[l.code];
              return (
                <Button
                  key={l.code}
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => runTranslate(l.code)}
                  disabled={loading === `translate-${l.code}`}
                >
                  {loading === `translate-${l.code}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : result ? (
                    result.mode === "llm" ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                    )
                  ) : null}
                  {l.label}
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
