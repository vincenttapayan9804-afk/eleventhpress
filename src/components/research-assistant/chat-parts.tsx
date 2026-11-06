"use client";

// Pieces shared by both AI Research Assistant chats: Ask the Corpus
// (corpus-chat-panel.tsx) and Ask this paper (article-chat-panel.tsx).

import { useEffect, useState } from "react";
import { CornerDownRight, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ResearchMascot } from "./mascot";
import type { AnswerData, SectionQuestion } from "./types";

export interface ApiAnswer extends Partial<AnswerData> {
  mode: "answered" | "unavailable" | "not-indexed";
  message?: string;
  answer?: string;
}

export function toAnswerData(res: ApiAnswer): AnswerData {
  return {
    grounded: res.grounded !== false,
    intent: res.intent,
    citations: Array.isArray(res.citations) ? res.citations : [],
    sources: Array.isArray(res.sources) ? res.sources : [],
    evidence: res.evidence,
    evidenceIds: Array.isArray(res.evidenceIds) ? res.evidenceIds : [],
    suggestedQuestions: Array.isArray(res.suggestedQuestions) ? res.suggestedQuestions : [],
    sectionQuestions: Array.isArray(res.sectionQuestions) ? res.sectionQuestions : [],
    sectionArticle: res.sectionArticle ?? null,
    sectionArticleId: res.sectionArticleId ?? null,
    model: res.model,
    answeredAt: res.answeredAt,
  };
}

const CORPUS_STEPS = [
  "Understanding your question…",
  "Searching the journal's published articles…",
  "Reading the most relevant passages…",
  "Checking the evidence…",
  "Writing a cited answer…",
];

/** Step-by-step progress with the mascot looking around while it searches. */
export function Thinking({
  steps = CORPUS_STEPS,
  label = "The Research Assistant is searching the journal",
}: {
  steps?: string[];
  label?: string;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 2600);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3.5 shadow-sm" role="status" aria-live="polite">
      <ResearchMascot state="thinking" size={40} title={label} />
      <div>
        <p className="text-sm font-medium text-foreground">{steps[step]}</p>
        <div className="mt-1.5 flex gap-1" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={cn("h-1 w-6 rounded-full transition-colors duration-500", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </div>
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
      <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
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
      <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s.section}
            type="button"
            onClick={() => onPick(s.question)}
            disabled={disabled}
            title={s.question}
            aria-label={s.question}
            className="rounded-full border border-border bg-background px-3 py-1 text-[0.72rem] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {s.section}
          </button>
        ))}
      </div>
    </div>
  );
}
