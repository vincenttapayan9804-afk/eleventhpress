"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
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
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Plus,
  History,
  Pencil,
  Save,
  XCircle,
  FileDown,
  Quote,
  Share2,
  UserPlus,
  Trash2,
  FileUp,
  ArrowRightCircle,
} from "lucide-react";
import { parseBibTeX } from "@/lib/citation-import";

interface ArticleHit {
  id: string;
  title: string;
}

interface ExternalSource {
  url: string;
  title: string;
  authors?: string;
  year?: number | null;
  venue?: string | null;
}

interface DiscoveryResult {
  source: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string;
  openAccessUrl: string | null;
}

/** Maps a mode:"unavailable" reason onto an honest, specific description —
 * replaces a blanket "no LLM configured" message that was misleading
 * whenever the real cause was a transient call failure, not a missing
 * provider. */
function unavailableDescription(reason: string | undefined): string {
  switch (reason) {
    case "no_provider":
      return "No LLM is configured on this deployment.";
    case "call_failed":
      return "The LLM call failed after a retry — try again in a moment.";
    case "insufficient_sources":
      return "Add more sources that could actually be read.";
    default:
      return "Try again in a moment.";
  }
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Download links for a saved ResearchLabDocument — hidden entirely when
 * there's no documentId (an "unavailable" run was never persisted, so
 * there's nothing to export). Plain anchors (not client-side fetch/blob)
 * since the route already sets Content-Disposition: attachment and the
 * session cookie rides along on a same-origin navigation. */
function ExportButtons({ documentId }: { documentId: string | undefined }) {
  if (!documentId) return null;
  const formats: { format: string; label: string }[] = [
    { format: "md", label: "Markdown" },
    { format: "pdf", label: "PDF" },
    { format: "bibtex", label: "BibTeX" },
    { format: "ris", label: "RIS" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      <FileDown className="h-3 w-3 text-muted-foreground" />
      {formats.map((f) => (
        <a
          key={f.format}
          href={`/api/research-lab/export/${documentId}?format=${f.format}`}
          className="rounded border border-border px-1.5 py-0.5 text-[0.6rem] text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          {f.label}
        </a>
      ))}
    </div>
  );
}

interface ShareEntry {
  id: string;
  createdAt: string;
  user: { id: string; email: string; fullName: string } | null;
}

/** Tier 3 team-workspace sharing: grants a collaborator (by their own
 * account email) read-only access to a saved document — its history entry
 * and exports, never edit rights (see research-lab-access.ts). Hidden
 * entirely for unsaved/"unavailable" runs, same posture as ExportButtons. */
function ShareControl({ documentId }: { documentId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<ShareEntry[] | null>(null);
  const [email, setEmail] = useState("");
  const [sharing, setSharing] = useState(false);

  async function load() {
    if (!documentId) return;
    try {
      const r = await apiFetch<{ shares: ShareEntry[] }>(`/api/research-lab/documents/${documentId}/share`);
      setShares(r.shares);
    } catch {
      setShares([]);
    }
  }

  function toggle() {
    setOpen((prev) => !prev);
    if (!shares) load();
  }

  async function addShare() {
    if (!documentId || !email.trim()) return;
    setSharing(true);
    try {
      await apiFetch(`/api/research-lab/documents/${documentId}/share`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail("");
      toast.success("Shared");
      load();
    } catch (e: any) {
      toast.error("Couldn't share", { description: e.message });
    } finally {
      setSharing(false);
    }
  }

  async function removeShare(shareId: string) {
    if (!documentId) return;
    try {
      await apiFetch(`/api/research-lab/documents/${documentId}/share?shareId=${shareId}`, { method: "DELETE" });
      setShares((prev) => (prev ? prev.filter((s) => s.id !== shareId) : prev));
    } catch (e: any) {
      toast.error("Couldn't remove access", { description: e.message });
    }
  }

  if (!documentId) return null;
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[0.65rem]" onClick={toggle}>
        <Share2 className="h-3 w-3" /> Share
      </Button>
      {open && (
        <div className="absolute right-0 top-7 z-10 w-64 space-y-1.5 rounded-md border border-border bg-popover p-2 shadow-md">
          <p className="text-[0.65rem] font-medium">Share with a collaborator</p>
          <div className="flex gap-1">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@university.edu"
              className="h-6 text-[0.65rem]"
            />
            <Button size="sm" className="h-6 shrink-0 px-1.5" disabled={sharing || !email.trim()} onClick={addShare}>
              {sharing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
            </Button>
          </div>
          {shares === null ? (
            <p className="text-[0.6rem] text-muted-foreground">Loading...</p>
          ) : shares.length === 0 ? (
            <p className="text-[0.6rem] text-muted-foreground">Not shared with anyone yet.</p>
          ) : (
            <div className="space-y-1">
              {shares.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-1 text-[0.6rem]">
                  <span className="min-w-0 truncate">{s.user?.fullName || s.user?.email || "Unknown user"}</span>
                  <button type="button" onClick={() => removeShare(s.id)} aria-label="Remove access">
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-rose-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[0.55rem] text-muted-foreground">They must already have an account on this platform. View-only access — they can&apos;t edit your saved draft.</p>
        </div>
      )}
    </div>
  );
}

/** Reference-manager interop (Tier 3): paste a .bib file exported from
 * Zotero/Mendeley/EndNote and add every entry that carries a real url/doi
 * straight into the external-sources list — the inverse of the BibTeX
 * export button. Entries with neither are reported, never silently
 * dropped or given a made-up URL (see citation-import.ts). */
function ImportBibTeXButton({ onImport }: { onImport: (entries: { url: string; title: string; authors?: string; year?: number | null; venue?: string | null }[]) => void }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");

  function doImport() {
    const { entries, skipped } = parseBibTeX(raw);
    if (entries.length > 0) {
      onImport(entries.map((e) => ({ url: e.url, title: e.title || e.url, authors: e.authors, year: e.year, venue: e.venue })));
    }
    if (entries.length > 0 && skipped.length === 0) {
      toast.success(`Imported ${entries.length} source(s)`);
    } else if (entries.length > 0) {
      toast.success(`Imported ${entries.length} source(s)`, { description: `${skipped.length} skipped — no url/doi field.` });
    } else {
      toast.error("Nothing importable found", { description: skipped[0]?.reason ?? "Paste a valid .bib file." });
    }
    setRaw("");
    setOpen(false);
  }

  return (
    <div>
      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setOpen((p) => !p)}>
        <FileUp className="h-3 w-3" /> Import BibTeX
      </Button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-md border border-border p-2">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste .bib entries exported from Zotero, Mendeley, EndNote, etc."
            className="min-h-24 font-mono text-[0.65rem]"
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 px-2 text-[0.65rem]" disabled={!raw.trim()} onClick={doImport}>
              Add sources
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[0.65rem]" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  crossref: "Crossref",
  openalex: "OpenAlex",
  semantic_scholar: "Semantic Scholar",
  eric: "ERIC",
  pubmed_central: "PubMed Central",
  zenodo: "Zenodo",
  core: "CORE",
};

/** Search-as-you-type over the platform's existing open-data discovery
 * fan-out (Crossref, OpenAlex, Semantic Scholar, ERIC, PubMed Central,
 * Zenodo, CORE — see /api/discover, also used by Resources → Discover).
 * Reused by both the Gap Finder and the PRISMA drafting tool so a
 * researcher can find external sources by topic instead of needing to
 * already have a URL to paste. A manual-paste fallback stays available
 * for anything the search doesn't surface. */
function ExternalSourceSearch({
  selected,
  onChange,
  maxSelected,
}: {
  selected: ExternalSource[];
  onChange: (next: ExternalSource[]) => void;
  maxSelected: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await apiFetch<{ results: DiscoveryResult[] }>(`/api/discover?q=${encodeURIComponent(query)}`);
        setResults(r.results.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  const selectedUrls = new Set(selected.map((s) => s.url));
  const atLimit = selected.length >= maxSelected;

  function addSource(source: ExternalSource) {
    if (!source.url || selectedUrls.has(source.url) || atLimit) return;
    onChange([...selected, source]);
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Crossref, OpenAlex, Semantic Scholar, PubMed Central, Zenodo, and more..."
          className="h-8 pl-8 text-xs"
          disabled={atLimit}
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="mt-1.5 space-y-1 rounded-md border border-border p-1.5">
          {searching ? (
            <p className="flex items-center gap-1.5 p-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching open-access sources...
            </p>
          ) : results.length === 0 ? (
            <p className="p-1.5 text-xs text-muted-foreground">No matches.</p>
          ) : (
            results.map((r) => {
              const url = r.openAccessUrl || r.url;
              const already = selectedUrls.has(url);
              return (
                <button
                  key={`${r.source}-${r.doi || r.url}`}
                  type="button"
                  disabled={already || atLimit}
                  onClick={() => addSource({ url, title: r.title, authors: r.authors, year: r.year, venue: r.venue })}
                  className="flex w-full items-start justify-between gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent disabled:opacity-40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{r.title}</span>
                    <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">
                      {[r.authors, r.year, r.venue].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {r.openAccessUrl && (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[0.55rem] text-emerald-700">
                        OA
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[0.55rem]">{SOURCE_LABELS[r.source] || r.source}</Badge>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
      <div className="mt-1.5 flex gap-1.5">
        <Input
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="...or paste a URL directly"
          className="h-7 text-xs"
          disabled={atLimit}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 px-2 text-xs"
          disabled={atLimit || !manualUrl.trim()}
          onClick={() => {
            addSource({ url: manualUrl.trim(), title: manualUrl.trim() });
            setManualUrl("");
          }}
        >
          Add
        </Button>
      </div>
      <div className="mt-1.5">
        <ImportBibTeXButton
          onImport={(entries) => {
            const additions = entries.filter((e) => !selectedUrls.has(e.url)).slice(0, Math.max(0, maxSelected - selected.length));
            if (additions.length > 0) onChange([...selected, ...additions]);
          }}
        />
      </div>
      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <Badge key={s.url} variant="secondary" className="gap-1 pr-1 text-[0.65rem]">
              <span className="max-w-[14rem] truncate">{s.title}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x.url !== s.url))}
                aria-label="Remove"
                className="-mr-0.5 rounded-full p-1 hover:bg-black/10"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
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
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s.id !== a.id))}
                aria-label="Remove"
                className="-mr-0.5 rounded-full p-1 hover:bg-black/10"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface FieldWithEvidence {
  value: string;
  quote: string;
  verified: boolean;
}
interface SourceMatrixEntry {
  researchDesign: FieldWithEvidence;
  participants: FieldWithEvidence;
  population: FieldWithEvidence;
  locale: FieldWithEvidence;
  theoreticalFramework: FieldWithEvidence;
  methodology: FieldWithEvidence;
  keyFindings: FieldWithEvidence;
  conclusions: FieldWithEvidence;
  recommendations: FieldWithEvidence;
  reference: string;
}
interface GapAnalysisSource {
  kind: "internal" | "external";
  id: string;
  title: string;
  excerpt: string;
  matrix: SourceMatrixEntry;
}
interface ResearchGap {
  gap: string;
  explanation: string;
}

const MATRIX_COLUMNS: { key: keyof Omit<SourceMatrixEntry, "reference">; label: string }[] = [
  { key: "researchDesign", label: "Research Design" },
  { key: "participants", label: "Respondents/Participants" },
  { key: "population", label: "Population/Sample" },
  { key: "locale", label: "Locale/Setting" },
  { key: "theoreticalFramework", label: "Theoretical Lens/Framework" },
  { key: "methodology", label: "Methodology" },
  { key: "keyFindings", label: "Key Findings" },
  { key: "conclusions", label: "Conclusions" },
  { key: "recommendations", label: "Recommendations" },
];

/** Renders the standard literature-review matrix (research design,
 * participants, population, locale, theoretical framework, methodology,
 * key findings, conclusions, recommendations) plus an APA 7th-edition
 * reference list — shared rendering for the Gap Finder's structured
 * result (the Systematic Review tool bakes the same matrix + references
 * directly into its markdown draft instead, see prisma-draft.ts). */
function SourceMatrixTable({ sources }: { sources: GapAnalysisSource[] }) {
  const hasAnalysis = sources.some((s) => s.matrix.researchDesign.value);
  return (
    <div className="space-y-2">
      {hasAnalysis && (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[900px] border-collapse text-[0.7rem]">
              <thead>
                <tr className="bg-accent/40">
                  <th className="border-b border-border p-1.5 text-left font-medium">Study</th>
                  {MATRIX_COLUMNS.map((c) => (
                    <th key={c.key} className="border-b border-border p-1.5 text-left font-medium">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="align-top odd:bg-accent/10">
                    <td className="max-w-[10rem] border-b border-border p-1.5 font-medium">{s.title}</td>
                    {MATRIX_COLUMNS.map((c) => {
                      const field = s.matrix[c.key];
                      return (
                        <td key={c.key} className="max-w-[12rem] border-b border-border p-1.5 text-muted-foreground">
                          {field.value ? (
                            <span
                              className="inline-flex items-start gap-1"
                              title={field.verified ? `Quote confirmed in source: "${field.quote}"` : "Could not confirm this claim's quote against the source text — verify by hand"}
                            >
                              {field.verified ? (
                                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                              ) : (
                                <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                              )}
                              {field.value}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-center gap-3 text-[0.65rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-600" /> quote confirmed in source</span>
            <span className="inline-flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-amber-600" /> quote could not be confirmed — verify by hand</span>
          </p>
        </>
      )}
      <div className="rounded-md border border-border p-2 text-[0.7rem]">
        <p className="mb-1 font-medium">References (APA 7th ed.)</p>
        <div className="space-y-1.5">
          {sources.map((s) => (
            <p key={s.id} className="text-muted-foreground">{s.matrix.reference}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
interface GapAnalysisResult {
  sources: GapAnalysisSource[];
  overview: string;
  gaps: ResearchGap[];
  skippedUrls: { url: string; reason: string }[];
  mode: "llm" | "unavailable";
  reason?: string;
  model?: string;
  documentId?: string;
}

interface GapAnalysisHistoryDoc {
  id: string;
  title: string;
  createdAt: string;
  editedAt: string | null;
  result: GapAnalysisResult;
}

interface PrismaSeed {
  articles: ArticleHit[];
  externalSources: ExternalSource[];
  searchStrategy: string;
}

function GapFinderPanel({ onChainToPrisma }: { onChainToPrisma: (seed: PrismaSeed) => void }) {
  const [selectedArticles, setSelectedArticles] = useState<ArticleHit[]>([]);
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GapAnalysisResult | null>(null);
  const [history, setHistory] = useState<GapAnalysisHistoryDoc[] | null>(null);
  const [sharedHistory, setSharedHistory] = useState<(GapAnalysisHistoryDoc & { owner: { fullName: string; email: string } | null })[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editOverview, setEditOverview] = useState("");
  const [editGaps, setEditGaps] = useState<ResearchGap[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadHistory() {
    setShowHistory((prev) => !prev);
    if (history) return;
    try {
      const r = await apiFetch<{ documents: GapAnalysisHistoryDoc[]; sharedDocuments: (GapAnalysisHistoryDoc & { owner: { fullName: string; email: string } | null })[] }>(
        "/api/research-lab/gap-analysis"
      );
      setHistory(r.documents);
      setSharedHistory(r.sharedDocuments);
    } catch {
      setHistory([]);
      setSharedHistory([]);
    }
  }

  function openHistoryDoc(doc: GapAnalysisHistoryDoc) {
    setResult({ ...doc.result, documentId: doc.id, mode: "llm" });
    setEditing(false);
    setShowHistory(false);
  }

  function chainToPrisma() {
    if (!result) return;
    const searchStrategy = [
      "Continuing from a Gap Finder analysis run in Eleventh Research Lab:",
      result.overview,
      "",
      "Gaps identified:",
      ...result.gaps.map((g) => `- ${g.gap}: ${g.explanation}`),
    ]
      .filter(Boolean)
      .join("\n");
    onChainToPrisma({
      articles: result.sources.filter((s) => s.kind === "internal").map((s) => ({ id: s.id, title: s.title })),
      externalSources: result.sources.filter((s) => s.kind === "external").map((s) => ({ url: s.id, title: s.title })),
      searchStrategy,
    });
    toast.success("Sent to Systematic Review tool", { description: "Sources and gaps carried over — switch tabs to continue." });
  }

  function startEdit() {
    if (!result) return;
    setEditOverview(result.overview);
    setEditGaps(result.gaps.map((g) => ({ ...g })));
    setEditing(true);
  }

  async function saveEdit() {
    if (!result?.documentId) return;
    setSaving(true);
    try {
      const r = await apiFetch<GapAnalysisHistoryDoc>(`/api/research-lab/gap-analysis/${result.documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ overview: editOverview, gaps: editGaps }),
      });
      setResult({ ...r.result, documentId: result.documentId, mode: "llm" });
      setHistory(null);
      setEditing(false);
      toast.success("Edits saved");
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function run() {
    if (selectedArticles.length + externalSources.length < 2) {
      toast.error("Add at least two sources", { description: "Pick published articles and/or external sources." });
      return;
    }
    setLoading(true);
    setEditing(false);
    try {
      const r = await apiFetch<GapAnalysisResult>("/api/research-lab/gap-analysis", {
        method: "POST",
        body: JSON.stringify({
          internalArticleIds: selectedArticles.map((a) => a.id),
          externalSources: externalSources.map((s) => ({ url: s.url, title: s.title, authors: s.authors, year: s.year, venue: s.venue })),
        }),
      });
      setResult(r);
      setHistory(null);
      if (r.mode === "llm") {
        toast.success(`Identified ${r.gaps.length} potential gap(s)`);
      } else {
        toast.error("Gap analysis unavailable", { description: unavailableDescription(r.reason) });
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
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="eyebrow flex items-center gap-1.5"><Search className="h-3 w-3" /> Research Gap Finder</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick internal articles and/or find external sources across Crossref, OpenAlex, Semantic Scholar, and more — then get a structured gap analysis grounded in what you provide.
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={loadHistory}>
            <History className="h-3 w-3" /> History
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showHistory && (
          <div className="rounded-md border border-border p-2">
            {history === null ? (
              <p className="flex items-center gap-1.5 p-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading history...</p>
            ) : history.length === 0 ? (
              <p className="p-1 text-xs text-muted-foreground">No saved runs yet.</p>
            ) : (
              <div className="space-y-1">
                {history.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => openHistoryDoc(doc)}
                    className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[0.6rem] text-muted-foreground">
                      {doc.editedAt && <Badge variant="outline" className="text-[0.55rem]">edited</Badge>}
                      {formatRelativeTime(doc.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {sharedHistory && sharedHistory.length > 0 && (
              <>
                <p className="mb-1 mt-2 text-[0.6rem] font-medium text-muted-foreground">Shared with me</p>
                <div className="space-y-1">
                  {sharedHistory.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => openHistoryDoc(doc)}
                      className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[0.6rem] text-muted-foreground">
                        {doc.owner && <Badge variant="outline" className="text-[0.55rem]">{doc.owner.fullName}</Badge>}
                        {formatRelativeTime(doc.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium">Internal articles</p>
          <ArticlePicker selected={selectedArticles} onChange={setSelectedArticles} maxSelected={8} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">External sources</p>
          <ExternalSourceSearch selected={externalSources} onChange={setExternalSources} maxSelected={8} />
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
                No gap analysis available — {unavailableDescription(result.reason)}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ExportButtons documentId={result.documentId} />
                  <div className="flex items-center gap-1">
                    {result.mode === "llm" && (
                      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[0.65rem]" onClick={chainToPrisma}>
                        <ArrowRightCircle className="h-3 w-3" /> Draft PRISMA review from this
                      </Button>
                    )}
                    <ShareControl documentId={result.documentId} />
                    {result.documentId && !editing && (
                      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[0.65rem]" onClick={startEdit}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
                {editing ? (
                  <div className="space-y-2 rounded-md border border-primary/30 bg-accent/20 p-2">
                    <div>
                      <p className="mb-1 text-xs font-medium">Overview</p>
                      <Textarea value={editOverview} onChange={(e) => setEditOverview(e.target.value)} className="min-h-20 text-xs" />
                    </div>
                    {editGaps.map((g, i) => (
                      <div key={i} className="space-y-1 rounded border border-border p-1.5">
                        <Input
                          value={g.gap}
                          onChange={(e) => setEditGaps((prev) => prev.map((x, idx) => (idx === i ? { ...x, gap: e.target.value } : x)))}
                          className="h-7 text-xs font-medium"
                        />
                        <Textarea
                          value={g.explanation}
                          onChange={(e) => setEditGaps((prev) => prev.map((x, idx) => (idx === i ? { ...x, explanation: e.target.value } : x)))}
                          className="min-h-14 text-xs"
                        />
                      </div>
                    ))}
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 gap-1 px-2 text-xs" disabled={saving} onClick={saveEdit}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save edits
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setEditing(false)}>
                        <XCircle className="h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {result.overview && (
                      <p className="rounded-md border border-border bg-accent/40 p-2 text-xs text-foreground/85">{result.overview}</p>
                    )}
                    <SourceMatrixTable sources={result.sources} />
                    {result.gaps.length === 0 ? (
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
                      </div>
                    )}
                  </>
                )}
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
  kind: "internal" | "external";
  id: string;
  title: string;
  excerpt: string;
}
interface PrismaFlowCounts {
  recordsIdentified: number;
  recordsExcludedAtScreening: number;
  reportsSoughtForRetrieval: number;
  reportsNotRetrieved: number;
  studiesIncluded: number;
}
interface PrismaDraftResult {
  sources: PrismaDraftSource[];
  skippedUrls: { url: string; reason: string }[];
  draft: string;
  flowCounts: PrismaFlowCounts;
  mode: "llm" | "unavailable";
  reason?: string;
  model?: string;
  documentId?: string;
}

interface PrismaDraftHistoryDoc {
  id: string;
  title: string;
  createdAt: string;
  editedAt: string | null;
  result: PrismaDraftResult;
}

interface ExcludedSourceInput {
  label: string;
  reason: string;
}

/** `seed` (when present) is only ever read as the initializer for this
 * component's own state — the parent remounts this panel with a fresh
 * `key` on every "Draft PRISMA review from this" hand-off (see
 * ResearchLabTab), so a plain useState initializer picks it up correctly
 * without an effect-driven setState-after-mount. */
function PrismaDraftPanel({ seed }: { seed: PrismaSeed | null }) {
  const [selectedArticles, setSelectedArticles] = useState<ArticleHit[]>(() => seed?.articles ?? []);
  const [externalSources, setExternalSources] = useState<ExternalSource[]>(() => seed?.externalSources ?? []);
  const [eligibilityCriteria, setEligibilityCriteria] = useState("");
  const [searchStrategy, setSearchStrategy] = useState(() => seed?.searchStrategy ?? "");
  const [excludedSources, setExcludedSources] = useState<ExcludedSourceInput[]>([]);
  const [excludedLabel, setExcludedLabel] = useState("");
  const [excludedReason, setExcludedReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrismaDraftResult | null>(null);
  const [history, setHistory] = useState<PrismaDraftHistoryDoc[] | null>(null);
  const [sharedHistory, setSharedHistory] = useState<(PrismaDraftHistoryDoc & { owner: { fullName: string; email: string } | null })[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadHistory() {
    setShowHistory((prev) => !prev);
    if (history) return;
    try {
      const r = await apiFetch<{ documents: PrismaDraftHistoryDoc[]; sharedDocuments: (PrismaDraftHistoryDoc & { owner: { fullName: string; email: string } | null })[] }>(
        "/api/research-lab/prisma-draft"
      );
      setHistory(r.documents);
      setSharedHistory(r.sharedDocuments);
    } catch {
      setHistory([]);
      setSharedHistory([]);
    }
  }

  function openHistoryDoc(doc: PrismaDraftHistoryDoc) {
    setResult({ ...doc.result, documentId: doc.id, mode: "llm" });
    setEditing(false);
    setShowHistory(false);
  }

  function startEdit() {
    if (!result) return;
    setEditDraft(result.draft);
    setEditing(true);
  }

  async function saveEdit() {
    if (!result?.documentId) return;
    setSaving(true);
    try {
      const r = await apiFetch<PrismaDraftHistoryDoc>(`/api/research-lab/prisma-draft/${result.documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ draft: editDraft }),
      });
      setResult({ ...r.result, documentId: result.documentId, mode: "llm" });
      setHistory(null);
      setEditing(false);
      toast.success("Edits saved");
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  function addExcluded() {
    if (!excludedLabel.trim()) return;
    setExcludedSources((prev) => [...prev, { label: excludedLabel.trim(), reason: excludedReason.trim() || "No reason recorded" }]);
    setExcludedLabel("");
    setExcludedReason("");
  }

  async function run() {
    if (selectedArticles.length + externalSources.length === 0) {
      toast.error("Select at least one included study");
      return;
    }
    setLoading(true);
    setEditing(false);
    try {
      const r = await apiFetch<PrismaDraftResult>("/api/research-lab/prisma-draft", {
        method: "POST",
        body: JSON.stringify({
          articleIds: selectedArticles.map((a) => a.id),
          externalSources: externalSources.map((s) => ({ url: s.url, title: s.title, authors: s.authors, year: s.year, venue: s.venue })),
          eligibilityCriteria,
          searchStrategy,
          excludedSources,
        }),
      });
      setResult(r);
      setHistory(null);
      if (r.mode === "llm") {
        toast.success("Review scaffold drafted");
      } else {
        toast.error("Draft unavailable", { description: unavailableDescription(r.reason) });
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
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="eyebrow flex items-center gap-1.5"><FileText className="h-3 w-3" /> Systematic Review / PRISMA Drafting Tool</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Record your own eligibility criteria and search strategy, select included studies and any candidates excluded at screening, and get a reproducible PRISMA flow diagram, screening log, and literature-matrix draft — every extracted claim is checked against the source&apos;s own text before it&apos;s shown. A first draft to revise, not a finished review.
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={loadHistory}>
            <History className="h-3 w-3" /> History
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showHistory && (
          <div className="rounded-md border border-border p-2">
            {history === null ? (
              <p className="flex items-center gap-1.5 p-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading history...</p>
            ) : history.length === 0 ? (
              <p className="p-1 text-xs text-muted-foreground">No saved drafts yet.</p>
            ) : (
              <div className="space-y-1">
                {history.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => openHistoryDoc(doc)}
                    className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[0.6rem] text-muted-foreground">
                      {doc.editedAt && <Badge variant="outline" className="text-[0.55rem]">edited</Badge>}
                      {formatRelativeTime(doc.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {sharedHistory && sharedHistory.length > 0 && (
              <>
                <p className="mb-1 mt-2 text-[0.6rem] font-medium text-muted-foreground">Shared with me</p>
                <div className="space-y-1">
                  {sharedHistory.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => openHistoryDoc(doc)}
                      className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[0.6rem] text-muted-foreground">
                        {doc.owner && <Badge variant="outline" className="text-[0.55rem]">{doc.owner.fullName}</Badge>}
                        {formatRelativeTime(doc.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium">Internal articles</p>
          <ArticlePicker selected={selectedArticles} onChange={setSelectedArticles} maxSelected={20} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">External sources</p>
          <ExternalSourceSearch selected={externalSources} onChange={setExternalSources} maxSelected={8} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">Eligibility criteria</p>
          <Textarea
            value={eligibilityCriteria}
            onChange={(e) => setEligibilityCriteria(e.target.value)}
            placeholder="e.g. Peer-reviewed studies published 2015–2025 involving adult participants, reporting a quantitative outcome measure..."
            className="min-h-16 text-xs"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">Search strategy</p>
          <Textarea
            value={searchStrategy}
            onChange={(e) => setSearchStrategy(e.target.value)}
            placeholder="e.g. Searched Crossref, OpenAlex, and PubMed Central for '(topic) AND (population)' on 2026-08-18, limited to English-language results..."
            className="min-h-16 text-xs"
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Your own words — this platform can&apos;t know what search you actually ran, so eligibility criteria and search strategy are never AI-generated.
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">Candidates excluded at screening</p>
          <div className="flex flex-wrap gap-1.5">
            <Input
              value={excludedLabel}
              onChange={(e) => setExcludedLabel(e.target.value)}
              placeholder="Title / citation"
              className="h-7 min-w-[10rem] flex-1 text-xs"
            />
            <Input
              value={excludedReason}
              onChange={(e) => setExcludedReason(e.target.value)}
              placeholder="Reason for exclusion"
              className="h-7 min-w-[10rem] flex-1 text-xs"
            />
            <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs" disabled={!excludedLabel.trim()} onClick={addExcluded}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          {excludedSources.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {excludedSources.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-[0.7rem]">
                  <span className="truncate"><span className="font-medium">{e.label}</span> — {e.reason}</span>
                  <button type="button" onClick={() => setExcludedSources((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove">
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Draft scaffold
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
              <p className="text-xs text-muted-foreground">No draft available — {unavailableDescription(result.reason)}</p>
            ) : (
              <div className="rounded-md border border-border p-2 text-xs">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[0.6rem]">{result.flowCounts.recordsIdentified} identified</Badge>
                    <Badge variant="outline" className="text-[0.6rem]">{result.flowCounts.recordsExcludedAtScreening} excluded</Badge>
                    <Badge variant="outline" className="text-[0.6rem]">{result.flowCounts.reportsNotRetrieved} not retrieved</Badge>
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[0.6rem] text-emerald-700">{result.flowCounts.studiesIncluded} included</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ExportButtons documentId={result.documentId} />
                    <ShareControl documentId={result.documentId} />
                    {result.documentId && !editing && (
                      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[0.65rem]" onClick={startEdit}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[0.65rem]" onClick={copyDraft}>
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                  </div>
                </div>
                {result.model && <p className="mb-1.5 text-[0.65rem] text-muted-foreground">Narrative sections generated by {result.model}</p>}
                {editing ? (
                  <div className="space-y-2">
                    <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="min-h-96 font-sans text-xs" />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 gap-1 px-2 text-xs" disabled={saving} onClick={saveEdit}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save edits
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setEditing(false)}>
                        <XCircle className="h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-sans text-foreground/85">{result.draft}</pre>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface TranscriptSegment {
  text: string;
  start: number | null;
  end: number | null;
}

interface TranscriptionJob {
  id: string;
  fileName: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  transcript: string | null;
  segmentsJson: string | null;
  model: string | null;
  errorMessage: string | null;
  createdAt: string;
}

/** MM:SS (or H:MM:SS past an hour) — Whisper's own chunk timestamps are
 * fractional seconds from the start of the recording. */
function formatTimestamp(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Timestamp-linked transcript view — one row per Whisper chunk with its
 * own real start/end offset, and a per-row "cite" button that copies a
 * ready-to-paste quote (e.g. for a qualitative-methods write-up) with its
 * timestamp attached, so a researcher doesn't have to hand-count minutes
 * into a 45-minute interview to attribute a quote. Falls back to the flat
 * transcript text when no chunk timestamps were captured (older jobs, or
 * a model run that didn't return them). */
function TranscriptSegments({ job }: { job: TranscriptionJob }) {
  const segments: TranscriptSegment[] = job.segmentsJson ? JSON.parse(job.segmentsJson) : [];
  if (segments.length === 0) {
    return <p className="whitespace-pre-wrap text-foreground/85">{job.transcript}</p>;
  }
  function citeSegment(seg: TranscriptSegment) {
    navigator.clipboard.writeText(`"${seg.text}" (${job.fileName} @ ${formatTimestamp(seg.start)})`);
    toast.success("Timestamped quote copied");
  }
  return (
    <div className="space-y-1">
      {segments.map((seg, i) => (
        <div key={i} className="flex items-start gap-1.5 rounded px-1 py-0.5 hover:bg-accent/40">
          <span className="mt-0.5 shrink-0 font-mono text-[0.6rem] text-muted-foreground">{formatTimestamp(seg.start)}</span>
          <p className="min-w-0 flex-1 text-foreground/85">{seg.text}</p>
          <button
            type="button"
            onClick={() => citeSegment(seg)}
            title="Copy this segment as a timestamped citation"
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Quote className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function TranscriptionPanel() {
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function retry(jobId: string) {
    setRetryingId(jobId);
    try {
      const r = await apiFetch<{ job: TranscriptionJob }>(`/api/research-lab/transcription/${jobId}/retry`, { method: "POST" });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? r.job : j)));
      if (r.job.status === "COMPLETED") {
        toast.success("Transcription complete");
      } else {
        toast.error("Transcription failed again", { description: r.job.errorMessage ?? undefined });
      }
    } catch (e: any) {
      toast.error("Retry failed", { description: e.message });
    } finally {
      setRetryingId(null);
    }
  }

  function copyTranscript(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Transcript copied to clipboard");
  }

  function downloadTranscript(job: TranscriptionJob) {
    if (!job.transcript) return;
    const blob = new Blob([job.transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.fileName.replace(/\.[^.]+$/, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
                  <>
                    <ScrollArea className="mt-1.5 max-h-48 epip-scroll">
                      <TranscriptSegments job={j} />
                    </ScrollArea>
                    <div className="mt-1.5 flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[0.65rem]" onClick={() => copyTranscript(j.transcript!)}>
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[0.65rem]" onClick={() => downloadTranscript(j)}>
                        <Download className="h-3 w-3" /> Download .txt
                      </Button>
                    </div>
                  </>
                )}
                {j.errorMessage && <p className="mt-1 text-rose-700">{j.errorMessage}</p>}
                {j.status === "FAILED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1.5 h-6 gap-1 px-2 text-[0.65rem]"
                    disabled={retryingId === j.id}
                    onClick={() => retry(j.id)}
                  >
                    {retryingId === j.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Retry
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface QuotaModule {
  moduleKey: string;
  label: string;
  used: number;
  limit: number | null;
}

// Researcher SaaS Phase 1/2 — only renders once the account has an
// effective researchPlan (planLabel non-null), whether purchased directly
// ("EXPLICIT") or bundled in via the account's tenant being on a
// University SaaS plan ("BUNDLED", Phase 2). Every pre-existing account
// and every tenant never assigned a plan resolves to no plan, so this
// stays invisible for them, matching zero-behavior-change.
function ResearcherUsageBanner() {
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [planSource, setPlanSource] = useState<"EXPLICIT" | "BUNDLED" | null>(null);
  const [modules, setModules] = useState<QuotaModule[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch<{ planLabel: string | null; planSource: "EXPLICIT" | "BUNDLED" | null; modules: QuotaModule[] }>(
          "/api/research-lab/quota"
        );
        setPlanLabel(r.planLabel);
        setPlanSource(r.planSource);
        setModules(r.modules);
      } catch {
        // Silent — a display-only convenience, never blocks the tools themselves.
      }
    })();
  }, []);

  if (!planLabel) return null;

  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
      <span className="font-medium">{planLabel}</span>
      {planSource === "BUNDLED" && <span className="text-muted-foreground"> (via your institution)</span>} — monthly usage:{" "}
      {modules
        .filter((m) => m.limit != null)
        .map((m) => `${m.label} ${m.used}/${m.limit}`)
        .join(" · ")}
    </div>
  );
}

export function ResearchLabTab() {
  const [activeTab, setActiveTab] = useState("gap-finder");
  const [prismaSeed, setPrismaSeed] = useState<PrismaSeed | null>(null);
  const [prismaSeedKey, setPrismaSeedKey] = useState(0);

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow flex items-center gap-1.5"><FlaskConical className="h-3 w-3" /> Eleventh Research Lab</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enterprise-grade research tools, powered by free open-source LLMs run locally or via the free tier — same honesty contract as every other AI feature on this platform: a real result or a clear "unavailable," never a guess.
        </p>
      </div>
      <ResearcherUsageBanner />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full max-w-md items-center gap-1 overflow-x-auto [&>*]:shrink-0">
          <TabsTrigger value="gap-finder">Gap Finder</TabsTrigger>
          <TabsTrigger value="prisma-draft">Systematic Review</TabsTrigger>
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
        </TabsList>
        <TabsContent value="gap-finder" className="mt-4">
          <GapFinderPanel
            onChainToPrisma={(seed) => {
              setPrismaSeed(seed);
              setPrismaSeedKey((k) => k + 1);
              setActiveTab("prisma-draft");
            }}
          />
        </TabsContent>
        <TabsContent value="prisma-draft" className="mt-4">
          <PrismaDraftPanel key={prismaSeedKey} seed={prismaSeed} />
        </TabsContent>
        <TabsContent value="transcription" className="mt-4">
          <TranscriptionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
