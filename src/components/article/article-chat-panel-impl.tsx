"use client";

// ---------------------------------------------------------------------------
// ArticleChatPanelImpl — "Ask this paper": the AI Research Assistant scoped
// to one article (src/app/api/articles/[id]/chat/route.ts).
//
// Same experience as Ask the Corpus, on the article page: the parrot
// mascot, structured answers with clickable citation numbers that preview
// the exact supporting passage, an evidence check, the verified APA
// reference, and controls to copy, copy citations, regenerate from the
// same evidence, view the evidence, export (PDF, Word, Markdown), rate,
// report an issue or continue the analysis. Suggested follow-ups and one
// question per part of the paper sit under the latest answer. The
// conversation is kept for this browser tab, so switching article tabs
// doesn't lose it.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, CornerDownRight, Loader2, RotateCcw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api-client";
import { sectionQuestions } from "@/lib/suggested-questions";
import { ResearchMascot } from "@/components/research-assistant/mascot";
import { AnswerView, type AnswerActions } from "@/components/research-assistant/answer-view";
import { EvidencePanel, type EvidenceSelection } from "@/components/research-assistant/evidence-panel";
import {
  ReportIssueDialog,
  SectionPills,
  SuggestionList,
  Thinking,
  toAnswerData,
  type ApiAnswer,
} from "@/components/research-assistant/chat-parts";
import { answerAsText, citationsText, copyText, downloadReport, exportItem } from "@/components/research-assistant/actions";
import type { AnswerData, ChatMessage } from "@/components/research-assistant/types";

const MAX_QUESTION = 800;
const MAX_STORED_MESSAGES = 24;
const UNAVAILABLE = "AI chat is temporarily unavailable for this article. Please try again in a few minutes.";

const PAPER_STEPS = [
  "Understanding your question…",
  "Searching this article's full text…",
  "Reading the most relevant passages…",
  "Checking the evidence…",
  "Writing a cited answer…",
];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

const storageKey = (articleId: string) => `ep-article-chat:${articleId}`;

function loadStored(articleId: string): ChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(articleId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && typeof m.id === "string")
      : [];
  } catch {
    return [];
  }
}

function saveStored(articleId: string, messages: ChatMessage[]) {
  try {
    if (messages.length === 0) window.sessionStorage.removeItem(storageKey(articleId));
    else window.sessionStorage.setItem(storageKey(articleId), JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // Storage full or blocked: the conversation just isn't kept.
  }
}

type Busy = { kind: "ask" } | { kind: "regenerate"; id: string } | null;

export function ArticleChatPanelImpl({ articleId, articleTitle }: { articleId: string; articleTitle: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [reportFor, setReportFor] = useState<ChatMessage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  // Restore this tab's conversation about this article (sessionStorage is
  // only readable after mount).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage after hydration
    setMessages(loadStored(articleId));
    restored.current = true;
  }, [articleId]);

  useEffect(() => {
    if (restored.current) saveStored(articleId, messages);
  }, [articleId, messages]);

  const starters = useMemo(() => sectionQuestions(articleTitle), [articleTitle]);
  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const selectedMessage = selection ? messages.find((m) => m.id === selection.messageId) : undefined;

  const scrollToEnd = () => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  function questionFor(answer: ChatMessage): ChatMessage | undefined {
    const i = messages.findIndex((m) => m.id === answer.id);
    return [...messages.slice(0, Math.max(i, 0))].reverse().find((m) => m.role === "user");
  }

  function historyBefore(list: ChatMessage[]) {
    return list.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  }

  /** 4xx messages (rate limit, question too long) are written for readers. */
  function readerError(e: any, fallback: string) {
    const status: number | undefined = e?.status;
    if (status && status >= 400 && status < 500 && e?.message) toast.error(e.message);
    else setUnavailable(fallback);
  }

  async function ask(text: string) {
    const question = text.trim().slice(0, MAX_QUESTION);
    if (!question || busy) return;
    const prior = historyBefore(messages);
    const userMsg: ChatMessage = { id: newId(), role: "user", content: question, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setFollowUp(null);
    setUnavailable(null);
    setBusy({ kind: "ask" });
    scrollToEnd();
    try {
      const res = await apiFetch<ApiAnswer>(`/api/articles/${articleId}/chat`, {
        method: "POST",
        body: JSON.stringify({ question, history: prior }),
      });
      if (res.mode === "answered" && res.answer) {
        const answer: ChatMessage = { id: newId(), role: "assistant", content: res.answer, createdAt: new Date().toISOString(), data: toAnswerData(res) };
        setMessages((prev) => [...prev, answer]);
      } else {
        setUnavailable(res.message || UNAVAILABLE);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInput(question);
      }
    } catch (e: any) {
      readerError(e, UNAVAILABLE);
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(question);
    } finally {
      setBusy(null);
    }
  }

  async function regenerate(answer: ChatMessage) {
    const q = questionFor(answer);
    if (!q || busy) return;
    const i = messages.findIndex((m) => m.id === q.id);
    setBusy({ kind: "regenerate", id: answer.id });
    setUnavailable(null);
    try {
      const res = await apiFetch<ApiAnswer>(`/api/articles/${articleId}/chat`, {
        method: "POST",
        body: JSON.stringify({
          question: q.content,
          history: historyBefore(messages.slice(0, i)),
          evidenceIds: answer.data?.evidenceIds ?? [],
          regenerate: true,
        }),
      });
      if (res.mode === "answered" && res.answer) {
        const data = toAnswerData(res);
        setMessages((prev) => prev.map((m) => (m.id === answer.id ? { ...m, content: res.answer!, data, createdAt: new Date().toISOString() } : m)));
        toast.success("Answer regenerated from the same evidence.");
      } else {
        toast.error(res.message || "The answer couldn't be regenerated right now.");
      }
    } catch (e: any) {
      toast.error(e?.status && e.status < 500 && e.message ? e.message : "The answer couldn't be regenerated right now.");
    } finally {
      setBusy(null);
    }
  }

  async function sendFeedback(answer: ChatMessage, rating: "HELPFUL" | "NOT_HELPFUL" | "ISSUE", issueType?: string, comment?: string) {
    const q = questionFor(answer);
    await apiFetch("/api/corpus-chat/feedback", {
      method: "POST",
      body: JSON.stringify({
        rating,
        issueType,
        comment,
        question: q?.content ?? "",
        answer: answer.content,
        articleIds: [articleId],
        model: answer.data?.model,
      }),
    });
    const data: AnswerData = {
      ...(answer.data ?? { grounded: true, citations: [], sources: [] }),
      ...(rating === "ISSUE" ? { reported: true } : { feedback: rating }),
    };
    setMessages((prev) => prev.map((m) => (m.id === answer.id ? { ...m, data } : m)));
  }

  const showEvidence = useCallback((m: ChatMessage, citation: number | null) => {
    // One source here, so "View evidence" opens straight on its passages.
    setSelection({ messageId: m.id, citation: citation ?? m.data?.citations[0]?.n ?? null, sourceId: m.data?.sources[0]?.id ?? null });
  }, []);

  function actionsFor(m: ChatMessage): AnswerActions {
    return {
      onCite: (n) => showEvidence(m, n),
      onShowSources: () => showEvidence(m, null),
      onRegenerate: () => void regenerate(m),
      onCopy: async () => {
        if (await copyText(answerAsText(m.content, m.data))) toast.success("Response copied with its reference.");
        else toast.error("Copying isn't available in this browser.");
      },
      onCopyCitations: async () => {
        if (await copyText(citationsText(m.data))) toast.success("Citations and reference copied.");
        else toast.error("Copying isn't available in this browser.");
      },
      onExport: (format) => {
        const q = questionFor(m);
        if (!q) return;
        setExporting(m.id);
        downloadReport(format, "response", q.content, [exportItem(q.content, m)])
          .then(() => toast.success("Your report is downloading."))
          .catch((e) => toast.error(e?.message || "The report couldn't be generated."))
          .finally(() => setExporting(null));
      },
      onFeedback: (rating) => {
        if (m.data?.feedback === rating) return;
        sendFeedback(m, rating)
          .then(() => toast.success(rating === "HELPFUL" ? "Thanks — glad it helped." : "Thanks for the feedback. It helps the editors improve the assistant."))
          .catch(() => toast.error("Feedback couldn't be sent. Please try again."));
      },
      onReport: () => setReportFor(m),
      onContinue: () => {
        setFollowUp(questionFor(m)?.content ?? null);
        textareaRef.current?.focus();
      },
    };
  }

  const intro = (
    <>
      Ask a question about &ldquo;{articleTitle}&rdquo;. Answers are grounded only in this article&apos;s own text, not general
      knowledge, and every claim links to the passage it came from.
    </>
  );

  const showFollowUps =
    !busy && lastAssistant?.data && ((lastAssistant.data.suggestedQuestions?.length ?? 0) > 0 || (lastAssistant.data.sectionQuestions?.length ?? 0) > 0);

  return (
    <Card className="paper-card gap-0 overflow-hidden py-0">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-start gap-3.5 bg-gradient-to-br from-[var(--royal-50)]/70 via-transparent to-transparent px-5 pb-3 pt-4 sm:border-b sm:border-border/70 sm:py-4 dark:from-primary/[0.08] sm:px-6">
          <ResearchMascot size={44} state={busy ? "thinking" : "idle"} className="mt-0.5" title="Research Assistant" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="font-display text-lg font-semibold">Ask this paper</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.62rem] font-medium text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Cited from this article
              </span>
            </div>
            <p className="mt-1 hidden text-sm leading-relaxed text-muted-foreground sm:block">{intro}</p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setUnavailable(null);
                setFollowUp(null);
                setSelection(null);
              }}
              disabled={!!busy}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label="Start a new conversation about this paper"
            >
              <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New chat</span>
            </button>
          )}
        </div>

        <p className="border-b border-border/70 px-5 pb-4 text-sm leading-relaxed text-muted-foreground sm:hidden">{intro}</p>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {unavailable && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-900 dark:text-amber-200" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{unavailable}</p>
            </div>
          )}

          {messages.length === 0 && !busy && (
            <SectionPills article={null} sections={starters} onPick={(q) => void ask(q)} disabled={!!busy} />
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={m.id} className="rounded-2xl border border-border/70 bg-card/60 px-4 py-4 shadow-sm sm:px-5">
                <AnswerView
                  message={m}
                  actions={actionsFor(m)}
                  busy={!!busy}
                  exporting={exporting === m.id}
                  isLatest={busy?.kind === "regenerate" && busy.id === m.id}
                  scope="article"
                />
              </div>
            )
          )}

          {busy?.kind === "ask" && <Thinking steps={PAPER_STEPS} label="The Research Assistant is reading this paper" />}

          {showFollowUps && lastAssistant?.data && (
            <div className="space-y-5 rounded-2xl border border-dashed border-border/90 p-4">
              <SuggestionList label="Ask next" questions={lastAssistant.data.suggestedQuestions ?? []} onPick={(q) => void ask(q)} disabled={!!busy} />
              <SectionPills article={null} sections={lastAssistant.data.sectionQuestions ?? []} onPick={(q) => void ask(q)} disabled={!!busy} />
            </div>
          )}
          <div ref={endRef} />

          {/* Composer */}
          <div>
            {followUp && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/[0.06] px-3 py-1.5 text-[0.72rem] text-foreground">
                <CornerDownRight className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span className="truncate">
                  Continuing the analysis of: <span className="font-medium">{followUp}</span>
                </span>
                <button type="button" onClick={() => setFollowUp(null)} className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void ask(input);
                  }
                }}
                placeholder={
                  followUp
                    ? "Ask a follow-up — “those findings” and “the second instrument” are understood…"
                    : "e.g. What method did the authors use, and what was the main finding?"
                }
                aria-label="Your question about this paper"
                className="max-h-[200px] min-h-[44px] flex-1 resize-none border-0 bg-transparent dark:bg-transparent px-1 py-2 text-[0.92rem] shadow-none focus-visible:ring-0"
                rows={1}
                maxLength={MAX_QUESTION}
                disabled={!!busy}
              />
              <button
                type="button"
                onClick={() => void ask(input)}
                disabled={!!busy || !input.trim()}
                className="mb-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground"
                aria-label="Send question"
              >
                {busy?.kind === "ask" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[0.64rem] text-muted-foreground">
              <span>Answers come only from this article and can still contain errors — check the cited passages.</span>
              <span className="hidden flex-shrink-0 tabular-nums sm:inline">
                Shift + Enter for a new line · {input.length}/{MAX_QUESTION}
              </span>
            </div>
          </div>
        </div>

        <Sheet open={!!selection} onOpenChange={(o) => !o && setSelection(null)}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-md [&>button]:hidden">
            <SheetTitle className="sr-only">Evidence</SheetTitle>
            <EvidencePanel data={selectedMessage?.data ?? null} selection={selection} onSelect={setSelection} onClose={() => setSelection(null)} />
          </SheetContent>
        </Sheet>

        <ReportIssueDialog
          key={reportFor?.id ?? "closed"}
          open={!!reportFor}
          onOpenChange={(o) => !o && setReportFor(null)}
          onSubmit={async (issueType, comment) => {
            if (!reportFor) return;
            try {
              await sendFeedback(reportFor, "ISSUE", issueType, comment);
              toast.success("Thank you. The editors will review this answer.");
            } catch {
              toast.error("The report couldn't be sent. Please try again.");
              throw new Error("report failed");
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
