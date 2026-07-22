"use client";

// ---------------------------------------------------------------------------
// CorpusChatPanel — the actual "Ask the Corpus" chat UI and logic. Split out
// from corpus-chat-widget.tsx so that widget can stay a cheap, eagerly
// mounted launcher button while this panel — the part with state, API
// calls, and message rendering — loads only once a visitor actually opens
// it (see corpus-chat-widget.tsx's dynamic() import of this module).
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Sparkles, Send, Loader2, AlertTriangle } from "lucide-react";
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
}

export function CorpusChatPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [messages, setMessages] = useState<CorpusChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const openArticle = useApp((s) => s.openArticle);

  async function send() {
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");
    setSending(true);
    setUnavailable(null);

    try {
      const res = await apiFetch<{
        mode: "answered" | "unavailable" | "not-indexed";
        message?: string;
        answer?: string;
        grounded?: boolean;
        citedChunks?: CorpusChatCitation[];
      }>("/api/corpus-chat", {
        method: "POST",
        body: JSON.stringify({ question: trimmed, history }),
      });

      if (res.mode === "answered" && res.answer) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.answer!, grounded: res.grounded, citations: res.citedChunks },
        ]);
      } else {
        setUnavailable(res.message || "Ask the Corpus isn't available right now.");
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send message");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

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

        <div className="mt-3 flex-1 space-y-3 overflow-y-auto epip-scroll pr-1">
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
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg rounded-bl-sm border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching the journal…
              </div>
            </div>
          )}
          {messages.length === 0 && !sending && (
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
          <Button size="icon" onClick={send} disabled={sending || !question.trim()} aria-label="Send">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
