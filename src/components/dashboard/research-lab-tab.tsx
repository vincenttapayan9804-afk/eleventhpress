"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  FlaskConical,
  Search,
  X,
  Loader2,
  Sparkles,
  FileText,
  Mic,
  Upload,
  Copy,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface ArticleHit {
  id: string;
  title: string;
}

/** Search-as-you-type picker over this platform's own published articles —
 * reused by both the Gap Finder and the PRISMA drafting tool below. */
function ArticlePicker({
  selected,
  onChange,
  maxSelected,
}: {
  selected: ArticleHit[];
  onChange: (next: ArticleHit[]) => void;
  maxSelected: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticleHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await apiFetch<{ items: ArticleHit[] }>(
          `/api/articles?q=${encodeURIComponent(query)}&pageSize=6`
        );
        setResults(r.items);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const selectedIds = new Set(selected.map((s) => s.id));

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search published articles by title, abstract, keywords..."
          className="h-8 pl-8 text-xs"
          disabled={selected.length >= maxSelected}
        />
      </div>
      {query.trim() && (
        <div className="mt-1.5 space-y-1 rounded-md border border-border p-1.5">
          {searching ? (
            <p className="flex items-center gap-1.5 p-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching...
            </p>
          ) : results.length === 0 ? (
            <p className="p-1.5 text-xs text-muted-foreground">No matches.</p>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={selectedIds.has(a.id) || selected.length >= maxSelected}
                onClick={() => {
                  onChange([...selected, a]);
                  setQuery("");
                }}
                className="w-full rounded px-1.5 py-1 text-left text-xs hover:bg-accent disabled:opacity-40"
              >
                {a.title}
              </button>
            ))
          )}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selected.map((a) => (
            <Badge key={a.id} variant="secondary" className="gap-1 pr-1 text-[0.65rem]">
              <span className="max-w-[14rem] truncate">{a.title}</span>
              <button type="button" onClick={() => onChange(selected.filter((s) => s.id !== a.id))} aria-label="Remove">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface GapAnalysisSource {
  kind: "internal" | "external";
  id: string;
  title: string;
  excerpt: string;
}
interface ResearchGap {
  gap: string;
  explanation: string;
}
interface GapAnalysisResult {
  sources: GapAnalysisSource[];
  gaps: ResearchGap[];
  skippedUrls: { url: string; reason: string }[];
  mode: "llm" | "unavailable";
  model?: string;
}

function GapFinderPanel() {
  const [selectedArticles, setSelectedArticles] = useState<ArticleHit[]>([]);
  const [externalUrlsText, setExternalUrlsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GapAnalysisResult | null>(null);

  async function run() {
    const externalUrls = externalUrlsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (selectedArticles.length + externalUrls.length < 2) {
      toast.error("Add at least two sources", { description: "Pick published articles and/or paste external links." });
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch<GapAnalysisResult>("/api/research-lab/gap-analysis", {
        method: "POST",
        body: JSON.stringify({ internalArticleIds: selectedArticles.map((a) => a.id), externalUrls }),
      });
      setResult(r);
      if (r.mode === "llm") {
        toast.success(`Identified ${r.gaps.length} potential gap(s)`);
      } else {
        toast.error("Gap analysis unavailable", { description: "No LLM configured, or too few sources could be read." });
      }
    } catch (e: any) {
      toast.error("Gap analysis failed", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3">
        <p className="eyebrow flex items-center gap-1.5"><Search className="h-3 w-3" /> Research Gap Finder</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick internal articles and/or paste external links (papers, preprints, reports), then get a structured gap analysis grounded in what you provide.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-medium">Internal articles</p>
          <ArticlePicker selected={selectedArticles} onChange={setSelectedArticles} maxSelected={8} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">External URLs (one per line)</p>
          <Textarea
            value={externalUrlsText}
            onChange={(e) => setExternalUrlsText(e.target.value)}
            placeholder={"https://example.org/some-paper\nhttps://example.org/another-report"}
            className="min-h-20 text-xs"
          />
        </div>
        <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Analyze for gaps
        </Button>

        {result && (
          <>
            <Separator />
            {result.skippedUrls.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                {result.skippedUrls.map((s) => (
                  <p key={s.url} className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" /> Couldn&apos;t read {s.url} — {s.reason}
                  </p>
                ))}
              </div>
            )}
            {result.mode === "unavailable" ? (
              <p className="text-xs text-muted-foreground">
                No gap analysis available — no LLM is configured, or fewer than two sources could be read.
              </p>
            ) : result.gaps.length === 0 ? (
              <p className="flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> No clear gaps identified from these sources.
              </p>
            ) : (
              <div className="space-y-2">
                {result.gaps.map((g, i) => (
                  <div key={i} className="rounded-md border border-border p-2 text-xs">
                    <p className="font-medium">{g.gap}</p>
                    <p className="mt-0.5 text-muted-foreground">{g.explanation}</p>
                  </div>
                ))}
                {result.model && <p className="text-[0.65rem] text-muted-foreground">Generated by {result.model}</p>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface PrismaDraftSource {
  articleId: string;
  title: string;
  abstract: string;
}
interface PrismaDraftResult {
  sources: PrismaDraftSource[];
  draft: string;
  mode: "llm" | "unavailable";
  model?: string;
}

function PrismaDraftPanel() {
  const [selectedArticles, setSelectedArticles] = useState<ArticleHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrismaDraftResult | null>(null);

  async function run() {
    if (selectedArticles.length === 0) {
      toast.error("Select at least one included study");
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch<PrismaDraftResult>("/api/research-lab/prisma-draft", {
        method: "POST",
        body: JSON.stringify({ articleIds: selectedArticles.map((a) => a.id) }),
      });
      setResult(r);
      if (r.mode === "llm") {
        toast.success("Review scaffold drafted");
      } else {
        toast.error("Draft unavailable", { description: "No LLM configured." });
      }
    } catch (e: any) {
      toast.error("Draft failed", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  function copyDraft() {
    if (!result?.draft) return;
    navigator.clipboard.writeText(result.draft);
    toast.success("Draft copied to clipboard");
  }

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3">
        <p className="eyebrow flex items-center gap-1.5"><FileText className="h-3 w-3" /> Systematic Review / PRISMA Drafting Tool</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select published articles as your included studies — drafts a review scaffold (rationale, synthesis, limitations) grounded only in their abstracts. A first draft to revise, not a finished review.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-medium">Included studies</p>
          <ArticlePicker selected={selectedArticles} onChange={setSelectedArticles} maxSelected={20} />
        </div>
        <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Draft scaffold
        </Button>

        {result && (
          <>
            <Separator />
            {result.mode === "unavailable" ? (
              <p className="text-xs text-muted-foreground">No draft available — no LLM is configured.</p>
            ) : (
              <div className="rounded-md border border-border p-2 text-xs">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-muted-foreground">{result.model && `Generated by ${result.model}`}</p>
                  <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[0.65rem]" onClick={copyDraft}>
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-sans text-foreground/85">{result.draft}</pre>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface TranscriptionJob {
  id: string;
  fileName: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  transcript: string | null;
  model: string | null;
  errorMessage: string | null;
  createdAt: string;
}

function TranscriptionPanel() {
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    apiFetch<{ jobs: TranscriptionJob[] }>("/api/research-lab/transcription")
      .then((r) => setJobs(r.jobs))
      .catch(() => setJobs([]));
  }, []);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".wav") && file.type !== "audio/wav" && file.type !== "audio/x-wav") {
      toast.error("WAV audio files only", { description: "Convert other formats to .wav before uploading." });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum 25 MB." });
      return;
    }
    setUploading(true);
    try {
      const presign = await apiFetch<{ uploadUrl: string; key: string; headers: Record<string, string> }>(
        "/api/storage/presign-local",
        { method: "POST", body: JSON.stringify({ filename: file.name, contentType: "audio/wav", bucket: "research-audio" }) }
      );
      const uploadRes = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: presign.headers });
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);

      const r = await apiFetch<{ success: boolean; job: TranscriptionJob }>("/api/research-lab/transcription", {
        method: "POST",
        body: JSON.stringify({ audioKey: presign.key, fileName: file.name }),
      });
      setJobs((prev) => [r.job, ...prev]);
      if (r.job.status === "COMPLETED") {
        toast.success("Transcription complete");
      } else {
        toast.error("Transcription failed", { description: r.job.errorMessage ?? undefined });
      }
    } catch (e: any) {
      toast.error("Transcription failed", { description: e.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3">
        <p className="eyebrow flex items-center gap-1.5"><Mic className="h-3 w-3" /> Qualitative Transcription</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a WAV recording (interview, oral history, field notes) — transcribed locally by an open-source Whisper model, no external API.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading + transcribing..." : "Choose a .wav file (max 25 MB)"}
          <input
            type="file"
            accept="audio/wav,audio/x-wav,.wav"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>

        {jobs.length > 0 && (
          <div className="space-y-2">
            {jobs.map((j) => (
              <div key={j.id} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium" title={j.fileName}>{j.fileName}</p>
                  <Badge
                    variant="outline"
                    className={`shrink-0 gap-1 text-[0.55rem] ${
                      j.status === "COMPLETED"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : j.status === "FAILED"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {j.status === "PROCESSING" || j.status === "QUEUED" ? (
                      <Clock className="h-2.5 w-2.5" />
                    ) : j.status === "COMPLETED" ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <AlertCircle className="h-2.5 w-2.5" />
                    )}
                    {j.status.toLowerCase()}
                  </Badge>
                </div>
                {j.transcript && (
                  <ScrollArea className="mt-1.5 max-h-32 epip-scroll">
                    <p className="whitespace-pre-wrap text-foreground/85">{j.transcript}</p>
                  </ScrollArea>
                )}
                {j.errorMessage && <p className="mt-1 text-rose-700">{j.errorMessage}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ResearchLabTab() {
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow flex items-center gap-1.5"><FlaskConical className="h-3 w-3" /> Eleventh Research Lab</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enterprise-grade research tools, powered by free open-source LLMs run locally or via the free tier — same honesty contract as every other AI feature on this platform: a real result or a clear "unavailable," never a guess.
        </p>
      </div>
      <Tabs defaultValue="gap-finder">
        <TabsList>
          <TabsTrigger value="gap-finder">Gap Finder</TabsTrigger>
          <TabsTrigger value="prisma-draft">Systematic Review</TabsTrigger>
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
        </TabsList>
        <TabsContent value="gap-finder" className="mt-4">
          <GapFinderPanel />
        </TabsContent>
        <TabsContent value="prisma-draft" className="mt-4">
          <PrismaDraftPanel />
        </TabsContent>
        <TabsContent value="transcription" className="mt-4">
          <TranscriptionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
