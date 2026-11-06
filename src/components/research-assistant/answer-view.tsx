"use client";

import { memo, useMemo } from "react";
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
  Library,
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
          className="mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-px items-center justify-center rounded-[5px] border border-[var(--royal-300)]/50 bg-[var(--royal-50)] px-1 align-middle font-sans text-[0.62rem] font-semibold tabular-nums text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Citation ${citation.n}: ${source?.title ?? "source"}`}
        >
          {citation.n}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-80 p-0">
        <div className="border-b border-border/70 px-3.5 py-2.5">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[var(--gold-600)]">
            Source {citation.sourceN} · {citation.kind === "record" ? "Article record" : "Full-text passage"}
          </p>
          <p className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-snug text-foreground">{source?.title}</p>
          {source && (source.authors.length > 0 || source.year) && (
            <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">
              {source.authors.map((a) => a.name).join(", ")}
              {source.year ? ` · ${source.year}` : ""}
            </p>
          )}
        </div>
        <p className="line-clamp-6 px-3.5 py-2.5 font-serif text-[0.78rem] italic leading-relaxed text-foreground/85">
          “{citation.text.replace(/\s+/g, " ").trim()}”
        </p>
        <p className="border-t border-border/70 px-3.5 py-1.5 text-[0.65rem] text-muted-foreground">Click to view in the evidence panel</p>
      </HoverCardContent>
    </HoverCard>
  );
}

function evidenceBadge(data: AnswerData) {
  const status = data.evidence?.status ?? (data.grounded ? "verified" : "unsupported");
  if (status === "verified") {
    return { icon: ShieldCheck, label: "Evidence verified", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  }
  if (status === "review") {
    return { icon: ShieldAlert, label: "Review details", cls: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300" };
  }
  return { icon: ShieldQuestion, label: "Not covered by the journal", cls: "border-border bg-muted/50 text-muted-foreground" };
}

export interface AnswerActions {
  onCite: (n: number) => void;
  onShowSources: () => void;
  onOpenArticle: (articleId: string) => void;
  onRegenerate: () => void;
  onCopy: () => void;
  onCopyCitations: () => void;
  onExport: (format: "pdf" | "docx" | "md") => void;
  onToggleSave: () => void;
  onFeedback: (rating: "HELPFUL" | "NOT_HELPFUL") => void;
  onReport: () => void;
  onContinue: () => void;
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
}: {
  message: ChatMessage;
  actions: AnswerActions;
  busy: boolean;
  exporting: boolean;
  isLatest: boolean;
}) {
  const data: AnswerData = message.data ?? { grounded: true, citations: [], sources: [] };
  const byN = useMemo(() => new Map(data.citations.map((c) => [c.n, c])), [data.citations]);
  const badge = evidenceBadge(data);
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
      thead: ({ children }) => <thead className="bg-[var(--royal-50)] text-[0.68rem] uppercase tracking-[0.08em] text-[var(--royal-800)]">{children}</thead>,
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
        <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--gold-600)]">
          {data.intent ? INTENT_LABEL[data.intent] : "Research answer"}
        </span>
        <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.66rem] font-medium", badge.cls)}>
          <BadgeIcon className="h-3 w-3" aria-hidden="true" />
          {badge.label}
        </span>
        {data.evidence?.passagesReviewed ? (
          <span className="text-[0.66rem] text-muted-foreground">
            {data.evidence.passagesReviewed} passages from {data.evidence.articlesReviewed} article{data.evidence.articlesReviewed === 1 ? "" : "s"} reviewed
          </span>
        ) : null}
      </header>

      <div className="text-[0.92rem] text-foreground/90">
        <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
          {linkCitations(message.content)}
        </ReactMarkdown>
      </div>

      {data.evidence && data.evidence.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-amber-900 dark:text-amber-200">
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

      {data.sources.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Verified sources</p>
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
                className="group/src inline-flex max-w-full items-center gap-2 rounded-lg border border-border/80 bg-background/80 py-1 pl-1 pr-2.5 text-left text-[0.72rem] transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--royal-50)] px-1 text-[0.62rem] font-bold text-primary">{s.n}</span>
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
        <ToolButton label={primary ? `Open article: ${primary.title}` : "Open article"} onClick={() => primary && actions.onOpenArticle(primary.id)} disabled={!primary}>
          <BookOpen className="h-4 w-4" />
        </ToolButton>
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
        <ToolButton label={message.saved ? "Saved — click to unsave" : "Save response"} onClick={actions.onToggleSave} active={message.saved}>
          {message.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </ToolButton>
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
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CornerDownRight className="h-3.5 w-3.5" /> Continue analysis
        </button>
      </div>
    </article>
  );
});
