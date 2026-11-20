"use client";

/**
 * Scholarly signals shown with a Research Assistant answer's sources:
 * correction and retraction notices, retracted references, citation counts
 * and community reviews (GET /api/corpus-chat/sources), the reader's chosen
 * citation style, and related work beyond the journal
 * (GET /api/corpus-chat/related). None of it is given to the model.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ArrowUpRight, Check, ClipboardCopy, Compass, Loader2, MessagesSquare, Quote, TrendingUp } from "lucide-react";
import { withWorkspaceTag } from "@/lib/api-client";
import { CITATION_STYLES, type CitationStyleId } from "@/lib/citation-styles";
import { cn } from "@/lib/utils";
import type { AnswerSource } from "./types";
import { copyText } from "./actions";

// ---------------------------------------------------------------------------
// Citation style: one choice per browser, shared by every answer.
// ---------------------------------------------------------------------------

const STYLE_KEY = "epip-ra-citation-style";
const styleListeners = new Set<() => void>();
let currentStyle: CitationStyleId | null = null;

function readStyle(): CitationStyleId {
  if (currentStyle) return currentStyle;
  let stored: string | null = null;
  try {
    stored = typeof window !== "undefined" ? window.localStorage.getItem(STYLE_KEY) : null;
  } catch {
    // storage blocked: fall back to APA
  }
  currentStyle = CITATION_STYLES.some((s) => s.id === stored) ? (stored as CitationStyleId) : "apa";
  return currentStyle;
}

/** The reader's citation style, outside React (copy and export). */
export function citationStyle(): CitationStyleId {
  return readStyle();
}

export function setCitationStyle(style: CitationStyleId) {
  currentStyle = style;
  try {
    window.localStorage.setItem(STYLE_KEY, style);
  } catch {
    // not remembered across visits; still applies now
  }
  styleListeners.forEach((l) => l());
}

export function useCitationStyle(): [CitationStyleId, (s: CitationStyleId) => void] {
  const style = useSyncExternalStore(
    (l) => {
      styleListeners.add(l);
      return () => styleListeners.delete(l);
    },
    readStyle,
    () => "apa" as CitationStyleId
  );
  return [style, setCitationStyle];
}

export function styleLabel(style: CitationStyleId): string {
  return CITATION_STYLES.find((s) => s.id === style)?.label ?? "APA (7th ed.)";
}

// ---------------------------------------------------------------------------
// Source signals, fetched once per (sources, style) and shared.
// ---------------------------------------------------------------------------

export interface SourceSignal {
  articleId: string;
  corrections: { type: string; label: string; title: string; issuedAt: string; doi: string | null }[];
  status: "retracted" | "concern" | "corrected" | null;
  retractedReferences: { doi: string; title: string | null; retractionDate: string | null }[] | null;
  citations: { count: number; url: string | null } | null;
  communityReviews: { count: number; items: { channel: string; url: string; reviewer: string | null; postedAt: string | null }[] };
  reference: string | null;
}

type SignalState = { status: "loading" } | { status: "ready"; byId: Map<string, SourceSignal> } | { status: "error" };

const signalCache = new Map<string, SignalState>();
const signalListeners = new Set<() => void>();
const inflight = new Map<string, Promise<void>>();

function signalKey(ids: string[], style: CitationStyleId): string {
  return `${style}|${ids.join(",")}`;
}

function loadSignals(ids: string[], style: CitationStyleId): Promise<void> {
  const key = signalKey(ids, style);
  const existing = inflight.get(key);
  if (existing) return existing;
  signalCache.set(key, { status: "loading" });
  const p = fetch(withWorkspaceTag(`/api/corpus-chat/sources?ids=${encodeURIComponent(ids.join(","))}&style=${style}`), { credentials: "same-origin" })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { sources: SourceSignal[] };
      signalCache.set(key, { status: "ready", byId: new Map(body.sources.map((s) => [s.articleId, s])) });
    })
    .catch(() => {
      signalCache.set(key, { status: "error" });
    })
    .finally(() => {
      inflight.delete(key);
      signalListeners.forEach((l) => l());
    });
  inflight.set(key, p);
  return p;
}

/** Signals for an answer's sources in the reader's citation style. */
export function useSourceSignals(sources: Pick<AnswerSource, "id">[]): { style: CitationStyleId; state: SignalState | undefined } {
  const [style] = useCitationStyle();
  const ids = sources.map((s) => s.id).slice(0, 12);
  const key = signalKey(ids, style);
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    signalListeners.add(l);
    return () => {
      signalListeners.delete(l);
    };
  }, []);
  useEffect(() => {
    if (ids.length > 0 && !signalCache.has(key)) void loadSignals(ids, style);
  }, [key]);
  return { style, state: ids.length ? signalCache.get(key) : undefined };
}

/**
 * A source's reference in the reader's style when it has been loaded,
 * otherwise the APA reference that came with the answer.
 */
export function referenceFor(source: AnswerSource, ids: string[]): string {
  const style = readStyle();
  if (style === "apa") return source.reference;
  const state = signalCache.get(signalKey(ids.slice(0, 12), style));
  return (state?.status === "ready" && state.byId.get(source.id)?.reference) || source.reference;
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

const FLAG_META = {
  retracted: { label: "Retracted", cls: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" },
  concern: { label: "Expression of concern", cls: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  corrected: { label: "Corrected", cls: "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-300" },
} as const;

/** A small badge for a source that carries a correction notice. */
export function SourceFlag({ signal, className }: { signal: SourceSignal | undefined; className?: string }) {
  if (!signal?.status) return null;
  const meta = FLAG_META[signal.status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[0.68rem] font-semibold", meta.cls, className)}>
      <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Corrections, citation count, community reviews and retracted references for one source. */
export function SourceSignalDetails({ signal, loading }: { signal: SourceSignal | undefined; loading: boolean }) {
  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Checking corrections, citations and reviews…
      </p>
    );
  }
  if (!signal) return null;
  const retractedRefs = signal.retractedReferences ?? [];
  return (
    <div className="space-y-3">
      {signal.corrections.length > 0 && (
        <section aria-label="Correction notices" className={cn("rounded-lg border px-3 py-2.5", signal.status ? FLAG_META[signal.status].cls : "")}>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {signal.status === "retracted"
              ? "This article has been retracted"
              : signal.status === "concern"
                ? "The journal has issued an expression of concern"
                : "This article has been corrected"}
          </p>
          <ul className="space-y-1 text-[0.75rem] leading-relaxed">
            {signal.corrections.map((c, i) => (
              <li key={`${c.type}-${i}`}>
                <span className="font-medium">{c.label}</span> · {formatDate(c.issuedAt)} — {c.title}
                {c.doi && (
                  <>
                    {" "}
                    <a href={`https://doi.org/${c.doi}`} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                      notice
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="h-3 w-3" aria-hidden="true" /> Cited by
        </dt>
        <dd className="text-foreground">
          {signal.citations ? (
            signal.citations.url ? (
              <a href={signal.citations.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                {signal.citations.count.toLocaleString("en")} work{signal.citations.count === 1 ? "" : "s"}
              </a>
            ) : (
              <span className="font-medium">
                {signal.citations.count.toLocaleString("en")} work{signal.citations.count === 1 ? "" : "s"}
              </span>
            )
          ) : (
            <span className="text-muted-foreground">Not yet indexed</span>
          )}
          <span className="text-muted-foreground"> · OpenAlex</span>
        </dd>
        <dt className="flex items-center gap-1 text-muted-foreground">
          <MessagesSquare className="h-3 w-3" aria-hidden="true" /> Community reviews
        </dt>
        <dd className="text-foreground">
          {signal.communityReviews.count === 0 ? (
            <span className="text-muted-foreground">None found</span>
          ) : (
            <ul className="space-y-0.5">
              {signal.communityReviews.items.map((r, i) => (
                <li key={`${r.url}-${i}`}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
                    {r.channel}
                    {r.reviewer ? ` · ${r.reviewer}` : ""}
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </a>
                  {r.postedAt && <span className="text-muted-foreground"> · {formatDate(r.postedAt)}</span>}
                </li>
              ))}
              {signal.communityReviews.count > signal.communityReviews.items.length && (
                <li className="text-muted-foreground">and {signal.communityReviews.count - signal.communityReviews.items.length} more on the article page</li>
              )}
            </ul>
          )}
        </dd>
        {signal.retractedReferences !== null && (
          <>
            <dt className="flex items-center gap-1 text-muted-foreground">
              <Quote className="h-3 w-3" aria-hidden="true" /> Its references
            </dt>
            <dd className={retractedRefs.length ? "text-red-700 dark:text-red-300" : "text-foreground"}>
              {retractedRefs.length === 0 ? (
                <span className="text-muted-foreground">No retracted references found (Retraction Watch)</span>
              ) : (
                <>
                  <span className="font-medium">
                    {retractedRefs.length} cited work{retractedRefs.length === 1 ? " has" : "s have"} since been retracted
                  </span>
                  <ul className="mt-0.5 space-y-0.5">
                    {retractedRefs.slice(0, 3).map((r) => (
                      <li key={r.doi}>
                        <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {r.title || r.doi}
                        </a>
                        {r.retractionDate && <span className="text-muted-foreground"> · retracted {formatDate(r.retractionDate)}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

/** The source's reference in a chosen style, with a style picker and copy. */
export function StyledReference({ source, signal, loading }: { source: AnswerSource; signal: SourceSignal | undefined; loading: boolean }) {
  const [style, setStyle] = useCitationStyle();
  const [copied, setCopied] = useState(false);
  const reference = style === "apa" ? source.reference : signal?.reference || null;
  const shown = reference ?? (loading ? null : source.reference);
  const copy = useCallback(async () => {
    if (!shown) return;
    if (await copyText(shown)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }, [shown]);
  return (
    <section aria-label="Reference" className="rounded-lg border border-border/80 bg-muted/30 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={`ref-style-${source.id}`} className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Reference
        </label>
        <select
          id={`ref-style-${source.id}`}
          value={style}
          onChange={(e) => setStyle(e.target.value as CitationStyleId)}
          className="h-7 max-w-[12rem] rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CITATION_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {reference ? (
        <p className="text-[0.76rem] leading-relaxed text-foreground">{reference}</p>
      ) : loading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Formatting…
        </p>
      ) : (
        <p className="text-[0.76rem] leading-relaxed text-foreground">
          {source.reference} <span className="text-muted-foreground">({styleLabel(style)} isn&apos;t available right now, so APA 7 is shown.)</span>
        </p>
      )}
      {shown && (
        <button
          type="button"
          onClick={copy}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy reference"}
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Related work beyond the journal
// ---------------------------------------------------------------------------

interface RelatedResult {
  source: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string;
  openAccessUrl: string | null;
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

/**
 * A reading list from open scholarly indexes, fetched only when asked for
 * and labelled as outside the journal. It never feeds the answer.
 */
export function RelatedWork({ question, sourceIds }: { question: string; sourceIds: string[] }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "error" } | { status: "ready"; results: RelatedResult[] }>({ status: "idle" });
  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(
        withWorkspaceTag(`/api/corpus-chat/related?q=${encodeURIComponent(question.slice(0, 500))}&ids=${encodeURIComponent(sourceIds.slice(0, 8).join(","))}`),
        { credentials: "same-origin" }
      );
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { results: RelatedResult[] };
      setState({ status: "ready", results: body.results ?? [] });
    } catch {
      setState({ status: "error" });
    }
  }, [question, sourceIds]);

  if (state.status === "idle") {
    return (
      <button
        type="button"
        onClick={() => void load()}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Compass className="h-3.5 w-3.5" aria-hidden="true" /> Related work beyond this journal
      </button>
    );
  }
  return (
    <section aria-label="Related work beyond this journal" className="rounded-xl border border-dashed border-border/90 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Compass className="h-3.5 w-3.5" aria-hidden="true" /> Related work beyond this journal
      </p>
      <p className="mt-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
        From open scholarly indexes. Not reviewed by the journal and not used in the answer above.
      </p>
      {state.status === "loading" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Searching Crossref, OpenAlex, Semantic Scholar and more…
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-2 text-xs text-muted-foreground">
          The search didn&apos;t complete.{" "}
          <button type="button" onClick={() => void load()} className="font-semibold text-primary hover:underline">
            Try again
          </button>
        </p>
      )}
      {state.status === "ready" &&
        (state.results.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nothing relevant turned up outside the journal.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {state.results.map((r) => (
              <li key={`${r.source}-${r.doi ?? r.url}`} className="text-[0.78rem] leading-snug">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:text-primary hover:underline">
                  {r.title}
                </a>
                <span className="block text-[0.7rem] text-muted-foreground">
                  {[r.authors && (r.authors.length > 80 ? `${r.authors.slice(0, 80)}…` : r.authors), r.venue, r.year].filter(Boolean).join(" · ")}
                  {" · "}
                  {SOURCE_LABELS[r.source] ?? r.source}
                  {r.openAccessUrl && (
                    <>
                      {" · "}
                      <a href={r.openAccessUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                        Open access
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
