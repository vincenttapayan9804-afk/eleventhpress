"use client";

// ---------------------------------------------------------------------------
// CorpusChatPanel — the actual "Ask the Corpus" chat UI and logic. Split out
// from corpus-chat-widget.tsx so that widget can stay a cheap, eagerly
// mounted launcher button while this panel — the part with state, API
// calls, and message rendering — loads only once a visitor actually opens
// it (see corpus-chat-widget.tsx's dynamic() import of this module).
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Sparkles, Send, Loader2, AlertTriangle, CornerDownRight } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { toast } from "sonner";

interface CorpusChatCitation {
  chunkIndex: number;
  text: string;
  matchType: "vector" | "lexical";
  articleId: string;
  articleTitle: string;
}

interface CorpusChatMessage {
  role: "user" | "assistant";
  content: string;
  grounded?: boolean;
  citations?: CorpusChatCitation[];
  suggestions?: string[];
  sections?: SectionQuestion[];
  sectionArticle?: string | null;
}

interface SectionQuestion {
  section: string;
  question: string;
}

/** One chip per part of the paper (Problem, Research gap, Respondents,
 * Instruments, Results, ...); clicking asks the full question. */
function SectionChips({
  article,
  sections,
  onPick,
  disabled,
}: {
  article: string | null | undefined;
  sections: SectionQuestion[];
  onPick: (q: string) => void;
  disabled: boolean;
}) {
  if (sections.length === 0) return null;
  const label = article ? `Explore “${article}” by section` : "Explore this paper by section";
  return (
    <div className="space-y-1.5" role="group" aria-label={label}>
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s.section}
            type="button"
            onClick={() => onPick(s.question)}
            disabled={disabled}
            title={s.question}
            aria-label={s.question}
            className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[0.7rem] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {s.section}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Ready-made questions shown as clickable chips. */
function SuggestionChips({
  label,
  questions,
  onPick,
  disabled,
}: {
  label: string;
  questions: string[];
  onPick: (q: string) => void;
  disabled: boolean;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="space-y-1.5" role="group" aria-label={label}>
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-1.5">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            disabled={disabled}
            className="flex w-full items-start gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-left text-xs leading-snug text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CornerDownRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" aria-hidden="true" />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CorpusChatPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [messages, setMessages] = useState<CorpusChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [messageListRef] = useAutoAnimate();
  const openArticle = useApp((s) => s.openArticle);
  const [starters, setStarters] = useState<string[]>([]);

  // Starter questions about the journal's newest articles, fetched once the
  // panel is first opened.
  useEffect(() => {
    if (!open || starters.length > 0) return;
    let cancelled = false;
    apiFetch<{ suggestedQuestions?: string[] }>("/api/corpus-chat")
      .then((res) => {
        if (!cancelled && Array.isArray(res.suggestedQuestions)) setStarters(res.suggestedQuestions);
      })
      .catch(() => {
        // Starters are optional; the example prompt below still shows.
      });
    return () => {
      cancelled = true;
    };
  }, [open, starters.length]);

  async function send(text?: string) {
    const trimmed = (text ?? question).trim();
    if (!trimmed || sending) return;

    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    if (text === undefined) setQuestion("");
    setSending(true);
    setUnavailable(null);

    try {
      const res = await apiFetch<{
        mode: "answered" | "unavailable" | "not-indexed";
        message?: string;
        answer?: string;
        grounded?: boolean;
        citedChunks?: CorpusChatCitation[];
        suggestedQuestions?: string[];
        sectionQuestions?: SectionQuestion[];
        sectionArticle?: string | null;
      }>("/api/corpus-chat", {
        method: "POST",
        body: JSON.stringify({ question: trimmed, history }),
      });

      if (res.mode === "answered" && res.answer) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.answer!,
            grounded: res.grounded,
            citations: res.citedChunks,
            suggestions: Array.isArray(res.suggestedQuestions) ? res.suggestedQuestions : [],
            sections: Array.isArray(res.sectionQuestions) ? res.sectionQuestions : [],
            sectionArticle: res.sectionArticle ?? null,
          },
        ]);
      } else {
        setUnavailable(res.message || "Ask the Corpus isn't available right now.");
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (e: any) {
      // 4xx messages (rate limit, question too long) are written for
      // readers; anything else (a 5xx, a network failure) gets the friendly
      // banner rather than a raw error string.
      const status: number | undefined = e?.status;
      if (status && status >= 400 && status < 500 && e?.message) {
        toast.error(e.message);
      } else {
        setUnavailable("Ask the Corpus is temporarily unavailable. Please try again in a few minutes.");
      }
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  const lastMessage = messages[messages.length - 1];
  const lastAssistant = lastMessage?.role === "assistant" ? lastMessage : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass-strong flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-4 w-4 text-primary" /> Ask the Corpus
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Ask a question across every published article in this journal — answers are grounded
            only in this journal&apos;s own text, with citations linking to the source article.
          </p>
        </SheetHeader>

        {unavailable && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{unavailable}</p>
          </div>
        )}

        <div ref={messageListRef} className="mt-3 flex-1 space-y-3 overflow-y-auto epip-scroll pr-1">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                    : "max-w-[85%] rounded-lg rounded-bl-sm border border-border bg-muted/30 px-3.5 py-2.5 text-sm"
                }
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.role === "assistant" && m.grounded === false && (
                  <p className="mt-1.5 text-[0.65rem] italic text-muted-foreground">
                    Not covered by this journal&apos;s published text.
                  </p>
                )}
                {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[0.65rem] font-medium text-primary">
                      {m.citations.length} passage{m.citations.length > 1 ? "s" : ""} cited
                    </summary>
                    <div className="mt-1.5 space-y-1.5">
                      {m.citations.map((c, ci) => (
                        <button
                          key={ci}
                          onClick={() => {
                            openArticle(c.articleId);
                            onOpenChange(false);
                          }}
                          className="block w-full rounded border border-border/60 bg-background/60 p-2 text-left text-[0.7rem] leading-snug text-muted-foreground hover:border-primary/40"
                        >
                          <span className="mb-1 block font-medium text-foreground">{c.articleTitle}</span>
                          {c.text}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}
          {!sending && lastAssistant && ((lastAssistant.suggestions?.length ?? 0) > 0 || (lastAssistant.sections?.length ?? 0) > 0) && (
            <div className="space-y-3 pl-1 pr-6">
              <SuggestionChips
                label="Ask next"
                questions={lastAssistant.suggestions ?? []}
                onPick={(q) => send(q)}
                disabled={sending}
              />
              <SectionChips
                article={lastAssistant.sectionArticle}
                sections={lastAssistant.sections ?? []}
                onPick={(q) => send(q)}
                disabled={sending}
              />
            </div>
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg rounded-bl-sm border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
                <ThinkingOrb state="searching" size={20} aria-label="Searching the journal" />
                Searching the journal…
              </div>
            </div>
          )}
          {messages.length === 0 && !sending && starters.length > 0 && (
            <div className="pt-4">
              <SuggestionChips
                label="Start with a recent paper"
                questions={starters}
                onPick={(q) => send(q)}
                disabled={sending}
              />
            </div>
          )}
          {messages.length === 0 && !sending && starters.length === 0 && (
            <p className="pt-6 text-center text-sm text-muted-foreground">
              Try: &ldquo;What have this journal&apos;s authors found about climate adaptation?&rdquo;
            </p>
          )}
        </div>

        <div className="mt-3 flex items-end gap-2 border-t border-border/60 pt-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask across every published article…"
            className="min-h-[2.5rem] resize-none text-sm"
            rows={1}
            maxLength={800}
            disabled={sending}
          />
          <Button size="icon" onClick={() => send()} disabled={sending || !question.trim()} aria-label="Send">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
