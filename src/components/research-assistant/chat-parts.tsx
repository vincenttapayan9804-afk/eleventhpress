"use client";

// Pieces shared by both AI Research Assistant chats: Ask the Corpus
// (corpus-chat-panel.tsx) and Ask this paper (article-chat-panel.tsx).

import { useEffect, useState } from "react";
import { CornerDownRight, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ResearchMascot } from "./mascot";
import type { AnswerData, AssistantQuota, SectionQuestion } from "./types";

export interface ApiAnswer extends Partial<AnswerData> {
  mode: "answered" | "unavailable" | "not-indexed" | "no-match" | "disabled" | "stopped";
  message?: string;
  answer?: string;
  quota?: AssistantQuota;
}

export function toAnswerData(res: ApiAnswer): AnswerData {
  return {
    grounded: res.grounded !== false,
    intent: res.intent,
    citations: Array.isArray(res.citations) ? res.citations : [],
    sources: Array.isArray(res.sources) ? res.sources : [],
    evidence: res.evidence,
    evidenceIds: Array.isArray(res.evidenceIds) ? res.evidenceIds : [],
    ...(res.coverage ? { coverage: res.coverage } : {}),
    suggestedQuestions: Array.isArray(res.suggestedQuestions) ? res.suggestedQuestions : [],
    sectionQuestions: Array.isArray(res.sectionQuestions) ? res.sectionQuestions : [],
    sectionArticle: res.sectionArticle ?? null,
    sectionArticleId: res.sectionArticleId ?? null,
    model: res.model,
    answeredAt: res.answeredAt,
  };
}

/** The server's steps, in order (see /api/corpus-chat's streamed stages). */
export type AnswerStage = "sending" | "understanding" | "searching" | "reading" | "writing" | "checking";

const STAGE_ORDER: AnswerStage[] = ["understanding", "searching", "reading", "writing", "checking"];

export interface StageState {
  stage: AnswerStage;
  passages?: number;
  articles?: number;
  scope?: string;
}

function stageText(s: StageState): string {
  switch (s.stage) {
    case "sending":
    case "understanding":
      return "Understanding your question…";
    case "searching":
      return s.scope ? `Searching ${s.scope}…` : "Searching the journal's published articles…";
    case "reading":
      return s.passages
        ? `Reading ${s.passages} relevant passage${s.passages === 1 ? "" : "s"} from ${s.articles} article${s.articles === 1 ? "" : "s"}…`
        : "Reading the most relevant passages…";
    case "writing":
      return "Writing a cited answer…";
    case "checking":
      return "Checking every citation against the sources…";
  }
}

const TIMED_STEPS = [
  "Understanding your question…",
  "Searching the published articles…",
  "Reading the most relevant passages…",
  "Checking the evidence…",
  "Writing a cited answer…",
];

/**
 * Progress while an answer is prepared, with the mascot looking around.
 * With `stage` it shows the server's real step (and how much evidence was
 * found); without it, timed steps. `onStop` adds a Stop button.
 */
export function Thinking({
  stage,
  steps = TIMED_STEPS,
  label = "The Research Assistant is searching the journal",
  onStop,
}: {
  stage?: StageState | null;
  steps?: string[];
  label?: string;
  onStop?: () => void;
}) {
  const [timed, setTimed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTimed((s) => Math.min(s + 1, steps.length - 1)), 2600);
    const e = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(t);
      clearInterval(e);
    };
  }, [steps.length]);
  const index = stage ? Math.max(0, STAGE_ORDER.indexOf(stage.stage === "sending" ? "understanding" : stage.stage)) : timed;
  const total = stage ? STAGE_ORDER.length : steps.length;
  const text = stage ? stageText(stage) : steps[timed];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3.5 shadow-sm">
      <ResearchMascot state="thinking" size={40} title={label} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground" role="status" aria-live="polite">
          {text}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cn("h-1 w-6 rounded-full transition-colors duration-500", i <= index ? "bg-primary" : "bg-border")} />
            ))}
          </div>
          {elapsed >= 3 && <span className="text-xs tabular-nums text-muted-foreground">{elapsed}s</span>}
        </div>
      </div>
      {onStop && (
        <button
          type="button"
          onClick={onStop}
          className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="h-2.5 w-2.5 rounded-[2px] bg-current" aria-hidden="true" /> Stop
        </button>
      )}
    </div>
  );
}

const ISSUE_TYPES = [
  { id: "INACCURATE", label: "Inaccurate information" },
  { id: "WRONG_CITATION", label: "A citation doesn't support the claim" },
  { id: "WRONG_ARTICLE", label: "The answer is about the wrong article" },
  { id: "MISSING_INFORMATION", label: "Missing or incomplete information" },
  { id: "OTHER", label: "Something else" },
] as const;

export function ReportIssueDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (issueType: string, comment: string) => Promise<void>;
}) {
  const [issueType, setIssueType] = useState<string>("INACCURATE");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Report an issue with this answer</DialogTitle>
          <DialogDescription>
            The journal&apos;s editors review every report. Tell us what&apos;s wrong so the answer can be checked against the articles.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">What&apos;s wrong?</legend>
          {ISSUE_TYPES.map((t) => (
            <label
              key={t.id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                issueType === t.id ? "border-primary/60 bg-primary/[0.06] text-foreground" : "border-border hover:border-primary/30"
              )}
            >
              <input type="radio" name="issueType" value={t.id} checked={issueType === t.id} onChange={() => setIssueType(t.id)} className="accent-[var(--royal-600)]" />
              {t.label}
            </label>
          ))}
        </fieldset>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: what should it have said? Which article or passage is affected?"
          maxLength={2000}
          className="min-h-[90px] text-sm"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit(issueType, comment);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send report
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SuggestionList({ label, questions, onPick, disabled }: { label: string; questions: string[]; onPick: (q: string) => void; disabled: boolean }) {
  if (questions.length === 0) return null;
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="grid gap-1.5">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            disabled={disabled}
            className="group flex w-full items-start gap-2 rounded-xl border border-border/80 bg-card/70 px-3.5 py-2.5 text-left text-[0.82rem] leading-snug text-foreground transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <CornerDownRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--gold-500)] transition-colors group-hover:text-primary" aria-hidden="true" />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionPills({ article, sections, onPick, disabled }: { article?: string | null; sections: SectionQuestion[]; onPick: (q: string) => void; disabled: boolean }) {
  if (sections.length === 0) return null;
  const label = article ? `Explore “${article}” by section` : "Explore this paper by section";
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s.section}
            type="button"
            onClick={() => onPick(s.question)}
            disabled={disabled}
            title={s.question}
            aria-label={s.question}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {s.section}
          </button>
        ))}
      </div>
    </div>
  );
}
