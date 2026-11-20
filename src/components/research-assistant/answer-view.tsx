"use client";

import { AiLabel } from "@/components/ai-label";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookmarkCheck,
  Bookmark,
  BookOpen,
  ClipboardCopy,
  Copy,
  CornerDownRight,
  Download,
  FileText,
  Flag,
  FolderPlus,
  GitBranch,
  Library,
  MoreHorizontal,
  SearchX,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { INTENT_LABEL, type AnswerCitation, type AnswerData, type ChatMessage } from "./types";
import { ResearchMascot } from "./mascot";

/** "[1][3]" → markdown links the renderer turns into citation chips. */
function linkCitations(md: string): string {
  return md.replace(/\[(\d{1,3})\](?!\()/g, (_m, n: string) => `[${n}](cite:${n})`);
}

function urlTransform(url: string): string {
  return url.startsWith("cite:") ? url : defaultUrlTransform(url);
}

function CitationChip({ citation, data, onCite }: { citation: AnswerCitation; data: AnswerData; onCite: (n: number) => void }) {
  const source = data.sources.find((s) => s.id === citation.articleId);
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onCite(citation.n)}
          className="mx-0.5 inline-flex h-[1.3rem] min-w-[1.3rem] -translate-y-px items-center justify-center rounded-[5px] border border-[var(--royal-300)]/50 bg-[var(--royal-50)] px-1 align-middle font-sans text-xs font-semibold tabular-nums text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Citation ${citation.n}: ${source?.title ?? "source"}`}
        >
          {citation.n}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-80 p-0">
        <div className="border-b border-border/70 px-3.5 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gold-600)]">
            Source {citation.sourceN} · {citation.kind === "record" ? "Article record" : "Full-text passage"}
          </p>
          {citation.location && <p className="mt-0.5 line-clamp-1 text-xs font-medium text-muted-foreground">{citation.location}</p>}
          <p className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-snug text-foreground">{source?.title}</p>
          {source && (source.authors.length > 0 || source.year) && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {source.authors.map((a) => a.name).join(", ")}
              {source.year ? ` · ${source.year}` : ""}
            </p>
          )}
        </div>
        <p className="line-clamp-6 px-3.5 py-2.5 font-serif text-[0.82rem] italic leading-relaxed text-foreground/85">
          “{citation.text.replace(/\s+/g, " ").trim()}”
        </p>
        <p className="border-t border-border/70 px-3.5 py-1.5 text-xs text-muted-foreground">Click or press Enter to view it in the evidence panel</p>
      </HoverCardContent>
    </HoverCard>
  );
}

function evidenceBadge(data: AnswerData, scope: "journal" | "article") {
  const status = data.evidence?.status ?? (data.grounded ? "verified" : "unsupported");
  if (status === "verified") {
    return { icon: ShieldCheck, label: "Evidence verified", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  }
  if (status === "review") {
    return { icon: ShieldAlert, label: "Review details", cls: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300" };
  }
  return { icon: ShieldQuestion, label: scope === "article" ? "Not covered by this article" : "Not covered by the journal", cls: "border-border bg-muted/50 text-muted-foreground" };
}

export interface AnswerActions {
  onCite: (n: number) => void;
  onShowSources: () => void;
  /** Omit to hide "Open article" (e.g. inside the article itself). */
  onOpenArticle?: (articleId: string) => void;
  onRegenerate: () => void;
  onCopy: () => void;
  onCopyCitations: () => void;
  onExport: (format: "pdf" | "docx" | "md") => void;
  /** Omit to hide "Save" (no conversation storage). */
  onToggleSave?: () => void;
  onFeedback: (rating: "HELPFUL" | "NOT_HELPFUL") => void;
  onReport: () => void;
  onContinue: () => void;
  /** Download the answer's sources for a reference manager. */
  onExportCitations?: (format: "ris" | "bibtex") => void;
  /** File the response in a collection (saves it too). */
  onAddToCollection?: () => void;
  /** Start a new conversation from this point. */
  onBranch?: () => void;
  /** Ask again with a narrower or wider scope (shown when the journal doesn't cover a question). */
  onWidenScope?: () => void;
}

const COVERAGE_META: Record<NonNullable<AnswerData["coverage"]>["level"], { label: string; bars: number; cls: string }> = {
  strong: { label: "Strong coverage", bars: 4, cls: "bg-emerald-500" },
  partial: { label: "Partial coverage", bars: 3, cls: "bg-sky-500" },
  limited: { label: "Limited coverage", bars: 2, cls: "bg-amber-500" },
  none: { label: "Not covered", bars: 0, cls: "bg-muted-foreground" },
};

/** "Based on 3 of 120 articles · Strong coverage", with a four-step meter. */
function CoverageMeter({ data, scope }: { data: AnswerData; scope: "journal" | "article" }) {
  const c = data.coverage;
  if (!c || scope === "article") return null;
  const meta = COVERAGE_META[c.level];
  const of = c.corpusArticles ? ` of ${c.corpusArticles}` : "";
  const text =
    c.level === "none"
      ? `No supporting evidence in ${c.articlesReviewed} article${c.articlesReviewed === 1 ? "" : "s"} searched`
      : `Based on ${c.citedArticles}${of} article${(c.corpusArticles ?? c.citedArticles) === 1 ? "" : "s"}`;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" title={c.scope ? `Searched: ${c.scope}` : "Searched the whole journal"}>
      <span className="inline-flex items-end gap-[2px]" role="img" aria-label={meta.label}>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("w-[3px] rounded-sm", i <= meta.bars ? meta.cls : "bg-border")} style={{ height: `${4 + i * 2}px` }} />
        ))}
      </span>
      <span>
        {text} · <span className="font-medium text-foreground/80">{meta.label}</span>
      </span>
    </span>
  );
}

/**
 * Reveals a just-arrived answer progressively (about 1–2.5 s), so it reads
 * like it's being written while the full, verified text is already here.
 * Skipped for readers who prefer reduced motion.
 */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function useReveal(text: string, enabled: boolean): { shown: string; revealing: boolean } {
  // Progress belongs to one text: a new (e.g. regenerated) answer starts again from 0.
  const [progress, setProgress] = useState<{ text: string; n: number }>({ text: "", n: 0 });
  const raf = useRef<number | null>(null);
  const animate = enabled && !prefersReducedMotion();
  useEffect(() => {
    if (!animate) return;
    const duration = Math.min(2500, Math.max(900, text.length * 2.2));
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2);
      setProgress({ text, n: Math.ceil(eased * text.length) });
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [text, animate]);
  const n = !animate ? text.length : progress.text === text ? progress.n : 0;
  if (n >= text.length) return { shown: text, revealing: false };
  // Never stop inside a citation marker or a word.
  let end = n;
  const open = text.lastIndexOf("[", end);
  if (open !== -1 && open > end - 5 && /^\[\d{0,3}$/.test(text.slice(open, end))) {
    const close = text.indexOf("]", end);
    if (close !== -1 && close - open <= 5) end = close + 1;
  }
  while (end < text.length && /\S/.test(text[end])) end++;
  return { shown: text.slice(0, end), revealing: true };
}

function ToolButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
            active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export const AnswerView = memo(function AnswerView({
  message,
  actions,
  busy,
  exporting,
  isLatest,
  scope = "journal",
  reveal = false,
}: {
  message: ChatMessage;
  actions: AnswerActions;
  busy: boolean;
  exporting: boolean;
  isLatest: boolean;
  /** "article": answering about one paper (Ask this paper). */
  scope?: "journal" | "article";
  /** Reveal the text progressively (a just-arrived answer). */
  reveal?: boolean;
}) {
  const { shown, revealing } = useReveal(message.content, reveal);
  const data: AnswerData = message.data ?? { grounded: true, citations: [], sources: [] };
  const byN = useMemo(() => new Map(data.citations.map((c) => [c.n, c])), [data.citations]);
  const badge = evidenceBadge(data, scope);
  const BadgeIcon = badge.icon;
  const primary = data.sources[0];

  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) => {
        if (href?.startsWith("cite:")) {
          const c = byN.get(Number(href.slice(5)));
          return c ? <CitationChip citation={c} data={data} onCite={actions.onCite} /> : null;
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
            {children}
          </a>
        );
      },
      h1: ({ children }) => <h3 className="mb-2 mt-5 font-display text-[1.02rem] font-semibold text-foreground first:mt-0">{children}</h3>,
      h2: ({ children }) => <h3 className="mb-2 mt-5 font-display text-[1.02rem] font-semibold text-foreground first:mt-0">{children}</h3>,
      h3: ({ children }) => (
        <h3 className="mb-2 mt-5 flex items-center gap-2 font-display text-[0.98rem] font-semibold text-foreground first:mt-0">
          <span className="h-3.5 w-[3px] rounded-full bg-[var(--gold-500)]" aria-hidden="true" />
          {children}
        </h3>
      ),
      h4: ({ children }) => <h4 className="mb-1.5 mt-4 text-sm font-semibold text-foreground">{children}</h4>,
      p: ({ children }) => <p className="my-2.5 leading-[1.75] first:mt-0 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="my-2.5 space-y-1.5 pl-1">{children}</ul>,
      ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-[var(--gold-600)]">{children}</ol>,
      li: ({ children }) => (
        <li className="relative leading-[1.7] [ol_&]:pl-1 [ul_&]:pl-4 [ul_&]:before:absolute [ul_&]:before:left-0 [ul_&]:before:top-[0.7em] [ul_&]:before:h-1.5 [ul_&]:before:w-1.5 [ul_&]:before:rounded-full [ul_&]:before:bg-[var(--royal-400)] [ul_&]:before:content-['']">
          {children}
        </li>
      ),
      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
      em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
      blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-[var(--gold-400)] pl-3.5 text-muted-foreground">{children}</blockquote>,
      table: ({ children }) => (
        <div className="my-3.5 overflow-x-auto rounded-lg border border-border/80 epip-scroll">
          <table className="w-full min-w-[560px] border-collapse text-left text-[0.8rem]">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-[var(--royal-50)] text-xs uppercase tracking-[0.08em] text-[var(--royal-800)]">{children}</thead>,
      th: ({ children }) => <th className="border-b border-border/80 px-3 py-2 font-semibold">{children}</th>,
      td: ({ children }) => <td className="border-b border-border/50 px-3 py-2 align-top leading-relaxed">{children}</td>,
      code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">{children}</code>,
      hr: () => <hr className="my-4 border-border/70" />,
    }),
    [byN, data, actions.onCite]
  );

  return (
    <article className="group/answer relative" aria-label="Research Assistant answer">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gold-600)]">
          <ResearchMascot size={20} motion="blink" />
          {data.intent ? INTENT_LABEL[data.intent] : "Research answer"}
        </span>
        <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", badge.cls)}>
          <BadgeIcon className="h-3 w-3" aria-hidden="true" />
          {badge.label}
        </span>
        {data.coverage && scope === "journal" ? (
          <CoverageMeter data={data} scope={scope} />
        ) : data.evidence?.passagesReviewed ? (
          <span className="text-xs text-muted-foreground">
            {scope === "article"
              ? `${data.evidence.passagesReviewed} passage${data.evidence.passagesReviewed === 1 ? "" : "s"} of this article reviewed`
              : `${data.evidence.passagesReviewed} passages from ${data.evidence.articlesReviewed} article${data.evidence.articlesReviewed === 1 ? "" : "s"} reviewed`}
          </span>
        ) : null}
        {data.continued && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="h-3 w-3" aria-hidden="true" /> Continues the earlier analysis
          </span>
        )}
        <AiLabel what="answer" className="ml-auto" />
      </header>

      {data.coverage?.scope && scope === "journal" && (
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">
          Searched only: <span className="font-medium text-foreground/80">{data.coverage.scope}</span>
        </p>
      )}

      {!data.grounded && scope === "journal" && !revealing && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-sm text-foreground" role="note">
          <SearchX className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-semibold">The journal&apos;s published articles don&apos;t cover this.</p>
            <p className="mt-0.5 text-[0.82rem] leading-relaxed text-muted-foreground">
              Nothing outside the journal is used, so no answer is made up.{" "}
              {data.coverage?.scope ? "Try widening the scope, or rephrase the question." : "Try rephrasing with the terms the articles use, or ask about a related topic."}
            </p>
            {actions.onWidenScope && data.coverage?.scope && (
              <button type="button" onClick={actions.onWidenScope} className="mt-1.5 text-[0.82rem] font-semibold text-primary hover:underline">
                Search the whole journal instead
              </button>
            )}
          </div>
        </div>
      )}

      <div className="text-[0.95rem] text-foreground/90" aria-busy={revealing}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
          {linkCitations(shown)}
        </ReactMarkdown>
        {revealing && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary align-baseline" aria-hidden="true" />}
      </div>

      {!revealing && data.evidence && data.evidence.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-amber-900 dark:text-amber-200">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Evidence check
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {data.evidence.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {!revealing && data.sources.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Verified sources</p>
          <div className="flex flex-wrap gap-1.5">
            {data.sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  const first = data.citations.find((c) => c.articleId === s.id);
                  if (first) actions.onCite(first.n);
                  else actions.onShowSources();
                }}
                className="group/src inline-flex max-w-full items-center gap-2 rounded-lg border border-border/80 bg-background/80 py-1 pl-1 pr-2.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--royal-50)] px-1 text-xs font-bold text-primary">{s.n}</span>
                <span className="line-clamp-1 max-w-[18rem] font-medium text-foreground">{s.title}</span>
                {s.year && <span className="shrink-0 text-muted-foreground">{s.year}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-0.5 border-t border-border/60 pt-2" role="toolbar" aria-label="Answer actions">
        <ToolButton label="Copy response" onClick={actions.onCopy}>
          <Copy className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Copy citations" onClick={actions.onCopyCitations} disabled={data.citations.length === 0}>
          <ClipboardCopy className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Regenerate from the same evidence" onClick={actions.onRegenerate} disabled={busy}>
          <RefreshCw className={cn("h-4 w-4", busy && isLatest && "animate-spin")} />
        </ToolButton>
        <ToolButton label="Expand sources" onClick={actions.onShowSources} disabled={data.sources.length === 0}>
          <Library className="h-4 w-4" />
        </ToolButton>
        {actions.onOpenArticle && (
          <ToolButton label={primary ? `Open article: ${primary.title}` : "Open article"} onClick={() => primary && actions.onOpenArticle?.(primary.id)} disabled={!primary}>
            <BookOpen className="h-4 w-4" />
          </ToolButton>
        )}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Export response"
                  disabled={exporting}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Export</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs">Export this response</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => actions.onExport("pdf")}>
              <FileText className="mr-2 h-4 w-4 text-primary" /> PDF research brief
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onExport("docx")}>
              <FileText className="mr-2 h-4 w-4 text-[#2b579a]" /> Word document (.docx)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.onExport("md")}>
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" /> Markdown (.md)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {actions.onToggleSave && (
          <ToolButton label={message.saved ? "Saved — click to unsave" : "Save response"} onClick={actions.onToggleSave} active={message.saved}>
            {message.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </ToolButton>
        )}
        {(actions.onExportCitations || actions.onAddToCollection || actions.onBranch) && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More actions"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">More</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-64">
              {actions.onExportCitations && (
                <>
                  <DropdownMenuLabel className="text-xs">Sources for a reference manager</DropdownMenuLabel>
                  <DropdownMenuItem disabled={data.sources.length === 0} onClick={() => actions.onExportCitations?.("ris")}>
                    <Download className="mr-2 h-4 w-4" /> RIS (Zotero, Mendeley, EndNote)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={data.sources.length === 0} onClick={() => actions.onExportCitations?.("bibtex")}>
                    <Download className="mr-2 h-4 w-4" /> BibTeX (LaTeX, Zotero)
                  </DropdownMenuItem>
                </>
              )}
              {(actions.onAddToCollection || actions.onBranch) && actions.onExportCitations && <DropdownMenuSeparator />}
              {actions.onAddToCollection && (
                <DropdownMenuItem onClick={actions.onAddToCollection}>
                  <FolderPlus className="mr-2 h-4 w-4" /> {message.folder ? `In “${message.folder}” — change collection` : "Add to a collection…"}
                </DropdownMenuItem>
              )}
              {actions.onBranch && (
                <DropdownMenuItem onClick={actions.onBranch}>
                  <GitBranch className="mr-2 h-4 w-4" /> Branch a new conversation from here
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <ToolButton label="Helpful" onClick={() => actions.onFeedback("HELPFUL")} active={data.feedback === "HELPFUL"}>
          <ThumbsUp className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Not helpful" onClick={() => actions.onFeedback("NOT_HELPFUL")} active={data.feedback === "NOT_HELPFUL"}>
          <ThumbsDown className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={data.reported ? "Issue reported" : "Report an issue"} onClick={actions.onReport} active={data.reported}>
          <Flag className="h-4 w-4" />
        </ToolButton>
        <button
          type="button"
          onClick={actions.onContinue}
          disabled={busy}
          title="Ask a follow-up that builds on this answer and its evidence"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-primary disabled:opacity-50 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CornerDownRight className="h-3.5 w-3.5" /> Continue analysis
        </button>
      </div>
    </article>
  );
});
