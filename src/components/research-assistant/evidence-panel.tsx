"use client";

import { useState } from "react";
import { ArrowUpRight, BookOpen, Check, ChevronLeft, ClipboardCopy, ExternalLink, FileSearch, Quote, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "./actions";
import type { AnswerData, AnswerSource } from "./types";

export interface EvidenceSelection {
  messageId: string;
  /** A citation number to preview, or null for the source list. */
  citation: number | null;
  /** A source id to preview without a specific citation. */
  sourceId?: string | null;
}

function CopyReference({ reference }: { reference: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(reference)) {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy reference"}
    </button>
  );
}

function Authors({ source }: { source: AnswerSource }) {
  if (source.authors.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-[0.78rem]">
      {source.authors.map((a, i) => (
        <li key={`${a.name}-${i}`} className="text-foreground">
          <span className="font-medium">{a.name}</span>
          {a.affiliation && <span className="text-muted-foreground"> · {a.affiliation}</span>}
        </li>
      ))}
    </ul>
  );
}

function ArticlePreview({
  data,
  source,
  citation,
  onBack,
  onOpenArticle,
}: {
  data: AnswerData;
  source: AnswerSource;
  citation: number | null;
  onBack: () => void;
  /** Omit to hide "Open article" (e.g. inside the article itself). */
  onOpenArticle?: (id: string) => void;
}) {
  const [showAbstract, setShowAbstract] = useState(false);
  const cited = data.citations.filter((c) => c.articleId === source.id);
  const focus = cited.find((c) => c.n === citation) ?? cited[0];
  const others = cited.filter((c) => c !== focus);

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> All sources
      </button>

      <div>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold-600)]">Source {source.n} · Article preview</p>
        <h3 className="mt-1.5 font-display text-[1.05rem] font-semibold leading-snug text-foreground">{source.title}</h3>
        <Authors source={source} />
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.74rem]">
          {source.publishedAt && (
            <>
              <dt className="text-muted-foreground">Published</dt>
              <dd className="text-foreground">{new Date(source.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</dd>
            </>
          )}
          {source.doi && (
            <>
              <dt className="text-muted-foreground">DOI</dt>
              <dd>
                <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-primary hover:underline">
                  {source.doi}
                </a>
              </dd>
            </>
          )}
          {source.discipline && (
            <>
              <dt className="text-muted-foreground">Discipline</dt>
              <dd className="text-foreground">{source.discipline}</dd>
            </>
          )}
        </dl>
        {source.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {source.keywords.map((k) => (
              <span key={k} className="rounded-full bg-[var(--royal-50)] px-2 py-0.5 text-[0.66rem] font-medium text-[var(--royal-800)]">
                {k}
              </span>
            ))}
          </div>
        )}
      </div>

      {focus && (
        <section aria-label="Supporting passage">
          <p className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Quote className="h-3 w-3" /> Supporting {focus.kind === "record" ? "record" : "passage"} [{focus.n}]
          </p>
          <blockquote className="rounded-r-lg border-l-[3px] border-[var(--gold-500)] bg-[var(--gold-200)]/25 px-3.5 py-3 font-serif text-[0.84rem] leading-relaxed text-foreground dark:bg-[var(--gold-500)]/10">
            {focus.text.replace(/\s+/g, " ").trim()}
          </blockquote>
          <a
            href={focus.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[0.72rem] font-medium text-primary hover:underline"
          >
            View this {focus.kind === "record" ? "article" : "passage in the article"} <ArrowUpRight className="h-3 w-3" />
          </a>
        </section>
      )}

      {others.length > 0 && (
        <section aria-label="Other cited passages">
          <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Also cited from this article</p>
          <div className="space-y-2">
            {others.map((c) => (
              <a
                key={c.n}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-border/70 px-3 py-2 text-[0.75rem] leading-relaxed text-muted-foreground transition-colors hover:border-primary/40"
              >
                <span className="line-clamp-3">
                  <span className="mr-1.5 font-semibold text-primary">[{c.n}]</span>
                  {c.text.replace(/\s+/g, " ").trim()}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {source.abstract && (
        <section aria-label="Abstract">
          <button
            type="button"
            onClick={() => setShowAbstract((v) => !v)}
            className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
            aria-expanded={showAbstract}
          >
            Abstract {showAbstract ? "−" : "+"}
          </button>
          <p className={cn("text-[0.78rem] leading-relaxed text-foreground/85", !showAbstract && "line-clamp-4")}>{source.abstract}</p>
        </section>
      )}

      <section aria-label="Reference" className="rounded-lg border border-border/80 bg-muted/30 p-3">
        <p className="mb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Reference (APA 7)</p>
        <p className="text-[0.76rem] leading-relaxed text-foreground">{source.reference}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        {onOpenArticle && (
          <button
            type="button"
            onClick={() => onOpenArticle(source.id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookOpen className="h-3.5 w-3.5" /> Open article
          </button>
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ExternalLink className="h-3.5 w-3.5" /> New tab
        </a>
        <CopyReference reference={source.reference} />
      </div>
    </div>
  );
}

export function EvidencePanel({
  data,
  selection,
  onSelect,
  onOpenArticle,
  onClose,
}: {
  data: AnswerData | null;
  selection: EvidenceSelection | null;
  onSelect: (sel: EvidenceSelection | null) => void;
  /** Omit to hide "Open article" (e.g. inside the article itself). */
  onOpenArticle?: (id: string) => void;
  onClose?: () => void;
}) {
  const citation = selection?.citation ?? null;
  const selectedSource =
    data && selection
      ? data.sources.find((s) => (citation !== null ? data.citations.find((c) => c.n === citation)?.articleId === s.id : s.id === selection.sourceId))
      : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold text-foreground">Evidence</h2>
          {data && data.sources.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.62rem] font-semibold text-muted-foreground">
              {data.sources.length} source{data.sources.length === 1 ? "" : "s"} · {data.citations.length} citation{data.citations.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close evidence panel">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 epip-scroll">
        {!data || data.sources.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--royal-50)]">
              <Quote className="h-5 w-5 text-primary" />
            </div>
            <p className="font-display text-sm font-semibold text-foreground">Sources appear here</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
              Every answer cites the journal articles and passages it draws on. Click a citation number to preview the article and the exact supporting passage.
            </p>
          </div>
        ) : selectedSource && selection ? (
          <ArticlePreview
            key={selectedSource.id}
            data={data}
            source={selectedSource}
            citation={citation}
            onBack={() => onSelect({ messageId: selection.messageId, citation: null })}
            onOpenArticle={onOpenArticle}
          />
        ) : (
          <div className="space-y-3">
            {data.sources.map((s) => {
              const cited = data.citations.filter((c) => c.articleId === s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selection && onSelect({ messageId: selection.messageId, citation: cited[0]?.n ?? null, sourceId: s.id })}
                  className="block w-full rounded-xl border border-border/80 bg-background p-3.5 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--royal-50)] text-[0.7rem] font-bold text-primary">{s.n}</span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-display text-[0.86rem] font-semibold leading-snug text-foreground">{s.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">
                        {s.authors.map((a) => a.name).join(", ") || "Authors not listed"}
                        {s.year ? ` · ${s.year}` : ""}
                      </p>
                      <p className="mt-1.5 text-[0.66rem] font-medium text-[var(--gold-600)]">
                        Cited as {cited.map((c) => `[${c.n}]`).join(" ")}
                        {s.doi ? ` · DOI ${s.doi}` : ""}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
