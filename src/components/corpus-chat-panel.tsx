"use client";

// ---------------------------------------------------------------------------
// CorpusChatPanel — the journal's AI Research Assistant ("Ask the Corpus"),
// a full-screen research workspace:
//
// - Left: journal branding and the assistant's identity, new conversation,
//   search, pinned and recent conversations, saved responses, and where
//   history is kept (the reader's account, or only this browser).
// - Centre: the conversation. Answers render as structured, cited research
//   notes (direct answer, evidence, comparison, interpretation,
//   limitations) with clickable citation numbers, an evidence check, the
//   verified sources, and controls to copy, copy citations, regenerate from
//   the same evidence, expand sources, open the article, export (PDF,
//   Word, Markdown), save, rate, report an issue or continue the analysis.
//   Suggested follow-ups and section-by-section questions sit under the
//   latest answer; a multiline composer sits at the bottom.
// - Right: the evidence panel — every source with its cited passages, and
//   an article preview with the exact supporting passage.
//
// Split out from corpus-chat-widget.tsx so the widget stays a cheap
// launcher; this module loads only when a reader opens the assistant.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowUp,
  Bookmark,
  BookOpenText,
  ChevronDown,
  CornerDownRight,
  Download,
  FileSearch,
  GitCompareArrows,
  Layers,
  Loader2,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Pin,
  PinOff,
  Quote,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { useTenantBranding } from "@/lib/tenant-branding-context";
import { JOURNAL_IDENTITY } from "@/lib/site";
import { withTrademark } from "@/lib/brand-mark";
import { ResearchMascot } from "@/components/research-assistant/mascot";
import { cn } from "@/lib/utils";
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
import { localId, titleFrom, useConversations } from "@/components/research-assistant/use-conversations";
import {
  answerAsText,
  citationsText,
  conversationItems,
  copyText,
  downloadReport,
  exportItem,
} from "@/components/research-assistant/actions";
import type {
  AnswerData,
  ChatMessage,
  ConversationSummary,
  JournalMasthead,
  SavedResponse,
  StarterPrompt,
} from "@/components/research-assistant/types";

const MAX_QUESTION = 800;
const WIDE = "(min-width: 1280px)";

function BrandMark({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  return logoUrl ? (
    <img src={logoUrl} alt={name} className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-1 ring-[var(--gold-400)]/50" />
  ) : (
    <span className="wax-mark flex-shrink-0" aria-hidden="true">
      <span className="wax-mark-text">EP</span>
    </span>
  );
}

/** Pinned, today, last 7 days, earlier. */
function groupConversations(list: ConversationSummary[]) {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const groups: { label: string; items: ConversationSummary[] }[] = [
    { label: "Pinned", items: [] },
    { label: "Today", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const c of list) {
    const t = new Date(c.updatedAt).getTime();
    if (c.pinned) groups[0].items.push(c);
    else if (t >= startOfToday.getTime()) groups[1].items.push(c);
    else if (now - t < 7 * 86_400_000) groups[2].items.push(c);
    else groups[3].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}


const PROMPT_ICONS: Record<StarterPrompt["category"], typeof BookOpenText> = {
  "Explore a paper": BookOpenText,
  "Compare studies": GitCompareArrows,
  "Synthesize the journal": Layers,
};

export function CorpusChatPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const user = useApp((s) => s.user);
  const openArticleInApp = useApp((s) => s.openArticle);
  const setView = useApp((s) => s.setView);
  const branding = useTenantBranding();
  const store = useConversations(!!user);

  const [journal, setJournal] = useState<JournalMasthead | null>(null);
  const [articleCount, setArticleCount] = useState<number | null>(null);
  const [prompts, setPrompts] = useState<StarterPrompt[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [title, setTitle] = useState("New conversation");
  const [pinned, setPinned] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<null | { kind: "ask" } | { kind: "regenerate"; id: string }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"history" | "saved">("history");
  const [saved, setSavedList] = useState<SavedResponse[]>([]);
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [mobileEvidence, setMobileEvidence] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<ChatMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConversationSummary | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Masthead and starter prompts, once the assistant is first opened.
  useEffect(() => {
    if (!open || journal) return;
    let cancelled = false;
    apiFetch<{ journal?: JournalMasthead; stats?: { articles: number | null }; prompts?: StarterPrompt[] }>("/api/corpus-chat")
      .then((res) => {
        if (cancelled) return;
        if (res.journal) setJournal(res.journal);
        setArticleCount(res.stats?.articles ?? null);
        if (Array.isArray(res.prompts)) setPrompts(res.prompts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, journal]);

  // Search conversations (debounced).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void store.refresh(search), 250);
    return () => clearTimeout(t);
  }, [search, open, store.mode]);

  useEffect(() => {
    if (sidebarTab === "saved" && open) void store.savedResponses().then(setSavedList);
  }, [sidebarTab, open, store]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  // Auto-grow the composer.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  const journalName = withTrademark(journal?.name) ?? branding.siteName ?? JOURNAL_IDENTITY.name;
  // The publishing house shown in full at the top of the sidebar.
  const publisherName = withTrademark(journal?.publisher) || branding.siteName || JOURNAL_IDENTITY.name;
  const selectedMessage = messages.find((m) => m.id === selection?.messageId && m.role === "assistant") ?? [...messages].reverse().find((m) => m.role === "assistant");
  const evidenceData = selectedMessage?.data ?? null;
  const lastMessage = messages[messages.length - 1];
  const lastAssistant = lastMessage?.role === "assistant" ? lastMessage : undefined;

  const history = useCallback(
    (upTo: ChatMessage[]) =>
      upTo.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.role === "assistant" ? { sources: m.data?.sources.map((s) => s.id) ?? [] } : {}),
      })),
    []
  );

  const resetConversation = useCallback(() => {
    setActiveId(null);
    setTitle("New conversation");
    setPinned(false);
    setMessages([]);
    setSelection(null);
    setNotice(null);
    setFollowUp(null);
    setInput("");
    setMobileSidebar(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const openConversation = useCallback(
    async (id: string, focusMessageId?: string) => {
      const c = await store.load(id);
      if (!c) {
        toast.error("That conversation couldn't be opened.");
        return;
      }
      setActiveId(c.id);
      setTitle(c.title);
      setPinned(c.pinned);
      setMessages(c.messages.map((m) => ({ ...m })));
      const target = focusMessageId ?? [...c.messages].reverse().find((m) => m.role === "assistant")?.id;
      setSelection(target ? { messageId: target, citation: null } : null);
      setNotice(null);
      setFollowUp(null);
      setMobileSidebar(false);
      if (focusMessageId) {
        setTimeout(() => document.getElementById(`msg-${focusMessageId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      }
    },
    [store]
  );

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    if (question.length > MAX_QUESTION) {
      toast.error(`Questions can be up to ${MAX_QUESTION} characters.`);
      return;
    }
    const prior = history(messages);
    const userMsg: ChatMessage = { id: localId(), role: "user", content: question, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setFollowUp(null);
    setBusy({ kind: "ask" });
    setNotice(null);
    try {
      const res = await apiFetch<ApiAnswer>("/api/corpus-chat", { method: "POST", body: JSON.stringify({ question, history: prior }) });
      if (res.mode === "answered" && res.answer) {
        const answerMsg: ChatMessage = { id: localId(), role: "assistant", content: res.answer, createdAt: new Date().toISOString(), data: toAnswerData(res) };
        setMessages((prev) => [...prev, answerMsg]);
        setSelection({ messageId: answerMsg.id, citation: null });
        const stored = await store.saveExchange(activeIdRef.current, userMsg, answerMsg);
        if (stored) {
          if (!activeIdRef.current) {
            setActiveId(stored.conversationId);
            activeIdRef.current = stored.conversationId;
            setTitle(titleFrom(question));
          }
          if (stored.answerId !== answerMsg.id || stored.questionId !== userMsg.id) {
            setMessages((prev) =>
              prev.map((m) => (m.id === userMsg.id ? { ...m, id: stored.questionId } : m.id === answerMsg.id ? { ...m, id: stored.answerId } : m))
            );
            setSelection((sel) => (sel?.messageId === answerMsg.id ? { ...sel, messageId: stored.answerId } : sel));
          }
        } else if (store.mode === "account") {
          toast.error("This answer couldn't be saved to your conversation history.");
        }
      } else {
        setNotice(res.message || "The Research Assistant isn't available right now.");
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInput(question);
      }
    } catch (e: any) {
      const status: number | undefined = e?.status;
      if (status && status >= 400 && status < 500 && e?.message) toast.error(e.message);
      else setNotice("The Research Assistant is temporarily unavailable. Please try again in a few minutes.");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(question);
    } finally {
      setBusy(null);
    }
  }

  function questionFor(answer: ChatMessage): ChatMessage | undefined {
    const i = messages.findIndex((m) => m.id === answer.id);
    return [...messages.slice(0, i)].reverse().find((m) => m.role === "user");
  }

  async function regenerate(answer: ChatMessage) {
    if (busy) return;
    const q = questionFor(answer);
    if (!q) return;
    const qi = messages.findIndex((m) => m.id === q.id);
    setBusy({ kind: "regenerate", id: answer.id });
    try {
      const res = await apiFetch<ApiAnswer>("/api/corpus-chat", {
        method: "POST",
        body: JSON.stringify({ question: q.content, history: history(messages.slice(0, qi)), regenerate: true, evidenceIds: answer.data?.evidenceIds ?? [] }),
      });
      if (res.mode === "answered" && res.answer) {
        const data = toAnswerData(res);
        setMessages((prev) => prev.map((m) => (m.id === answer.id ? { ...m, content: res.answer!, data } : m)));
        setSelection({ messageId: answer.id, citation: null });
        if (activeIdRef.current) await store.updateAnswer(activeIdRef.current, answer.id, res.answer, data);
        toast.success("Regenerated from the same evidence.");
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
        articleIds: answer.data?.sources.map((s) => s.id) ?? [],
        model: answer.data?.model,
      }),
    });
    const data: AnswerData = {
      ...(answer.data ?? { grounded: true, citations: [], sources: [] }),
      ...(rating === "ISSUE" ? { reported: true } : { feedback: rating }),
    };
    setMessages((prev) => prev.map((m) => (m.id === answer.id ? { ...m, data } : m)));
    if (activeIdRef.current) void store.updateAnswer(activeIdRef.current, answer.id, answer.content, data);
  }

  async function runExport(key: string, fn: () => Promise<void>) {
    setExporting(key);
    try {
      await fn();
      toast.success("Your report is downloading.");
    } catch (e: any) {
      toast.error(e?.message || "The report couldn't be generated.");
    } finally {
      setExporting(null);
    }
  }

  const showEvidence = useCallback((sel: EvidenceSelection) => {
    setSelection(sel);
    if (typeof window !== "undefined" && window.matchMedia(WIDE).matches) setEvidenceOpen(true);
    else setMobileEvidence(true);
  }, []);

  const openArticle = useCallback(
    (id: string) => {
      openArticleInApp(id);
      onOpenChange(false);
      setMobileEvidence(false);
    },
    [openArticleInApp, onOpenChange]
  );

  function actionsFor(m: ChatMessage): AnswerActions {
    return {
      onCite: (n) => showEvidence({ messageId: m.id, citation: n }),
      onShowSources: () => showEvidence({ messageId: m.id, citation: null }),
      onOpenArticle: openArticle,
      onRegenerate: () => void regenerate(m),
      onCopy: async () => {
        if (await copyText(answerAsText(m.content, m.data))) toast.success("Response copied with its references.");
        else toast.error("Copying isn't available in this browser.");
      },
      onCopyCitations: async () => {
        const ok = await copyText(citationsText(m.data));
        if (ok) toast.success("Citations and references copied.");
        else toast.error("Copying isn't available in this browser.");
      },
      onExport: (format) => {
        const q = questionFor(m);
        if (!q) return;
        void runExport(m.id, () => downloadReport(format, "response", q.content, [exportItem(q.content, m)]));
      },
      onToggleSave: async () => {
        if (!activeIdRef.current) return;
        const next = !m.saved;
        const ok = await store.setSaved(activeIdRef.current, m.id, next);
        if (!ok) {
          toast.error("That couldn't be saved. Please try again.");
          return;
        }
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, saved: next } : x)));
        toast.success(next ? "Saved to your saved responses." : "Removed from saved responses.");
        if (sidebarTab === "saved") void store.savedResponses().then(setSavedList);
      },
      onFeedback: (rating) => {
        if (m.data?.feedback === rating) return;
        sendFeedback(m, rating)
          .then(() => toast.success(rating === "HELPFUL" ? "Thanks — glad it helped." : "Thanks for the feedback. It helps the editors improve the assistant."))
          .catch(() => toast.error("Feedback couldn't be sent. Please try again."));
      },
      onReport: () => setReportFor(m),
      onContinue: () => {
        const q = questionFor(m);
        setFollowUp(q?.content ?? null);
        textareaRef.current?.focus();
      },
    };
  }

  const groups = useMemo(() => groupConversations(store.list), [store.list]);
  const promptGroups = useMemo(() => {
    const map = new Map<StarterPrompt["category"], StarterPrompt[]>();
    for (const p of prompts) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()];
  }, [prompts]);

  // ---- Sidebar -----------------------------------------------------------
  const sidebar = (
    <div className="flex h-full flex-col bg-[var(--royal-900)] text-white dark:bg-[oklch(0.17_0.04_292)]">
      <div className="border-b border-white/10 px-4 pb-4 pt-5">
        <div className="flex items-start gap-3 pr-7 lg:pr-0">
          <BrandMark logoUrl={branding.logoUrl} name={publisherName} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[0.95rem] font-semibold leading-snug [overflow-wrap:anywhere]">{publisherName}</p>
            {journalName !== publisherName && <p className="mt-1 text-[0.7rem] leading-snug text-white/70 [overflow-wrap:anywhere]">{journalName}</p>}
            <p className="mt-1 text-[0.64rem] uppercase tracking-[0.16em] text-[var(--gold-300)]">
              {journal?.issn ? `ISSN ${journal.issn}` : branding.tagline || "Peer-reviewed journal"}
            </p>
          </div>
        </div>
        <div className="group mt-4 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
          <span className="-my-1 flex h-11 w-10 items-end justify-center rounded-md bg-gradient-to-b from-[#bdf0ea]/25 to-transparent">
            <ResearchMascot size={36} state={busy ? "thinking" : "idle"} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.78rem] font-semibold leading-tight">AI Research Assistant</p>
            <p className="truncate text-[0.66rem] text-white/60">
              {articleCount ? `Grounded in ${articleCount} published article${articleCount === 1 ? "" : "s"}` : "Grounded in the journal's articles"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={resetConversation}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--gold-400)] px-3 py-2 text-sm font-semibold text-[#241b3a] shadow-sm transition-colors hover:bg-[var(--gold-300)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <MessageSquarePlus className="h-4 w-4" /> New conversation
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSidebarTab("history");
            }}
            placeholder="Search conversations"
            aria-label="Search previous conversations"
            className="h-8 w-full rounded-md border border-white/10 bg-white/[0.06] pl-8 pr-2 text-[0.78rem] text-white placeholder:text-white/40 focus:border-[var(--gold-400)]/60 focus:outline-none"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.05] p-0.5 text-[0.72rem] font-medium" role="tablist" aria-label="History">
          {(["history", "saved"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={sidebarTab === tab}
              onClick={() => setSidebarTab(tab)}
              className={cn("rounded-md py-1.5 transition-colors", sidebarTab === tab ? "bg-white/15 text-white" : "text-white/55 hover:text-white")}
            >
              {tab === "history" ? "Conversations" : "Saved responses"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-3 epip-scroll">
        {sidebarTab === "history" ? (
          groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-[0.75rem] leading-relaxed text-white/50">
              {search ? "No conversations match your search." : "Your conversations will appear here."}
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mt-2">
                <p className="px-2.5 pb-1 pt-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/40">{g.label}</p>
                {g.items.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "group/conv relative flex items-center rounded-md transition-colors",
                      c.id === activeId ? "bg-white/[0.12]" : "hover:bg-white/[0.06]"
                    )}
                  >
                    {renaming?.id === c.id ? (
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                        onBlur={async () => {
                          await store.rename(c.id, renaming.value);
                          if (c.id === activeId) setTitle(renaming.value.trim() || title);
                          setRenaming(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        maxLength={120}
                        aria-label="Conversation name"
                        className="m-1 h-7 w-full rounded border border-[var(--gold-400)]/60 bg-white/10 px-2 text-[0.78rem] text-white focus:outline-none"
                      />
                    ) : (
                      <button type="button" onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                        <span className="flex items-center gap-1.5">
                          {c.pinned && <Pin className="h-3 w-3 flex-shrink-0 text-[var(--gold-300)]" aria-label="Pinned" />}
                          <span className="truncate text-[0.8rem] text-white/90">{c.title}</span>
                        </span>
                        {c.match && <span className="mt-0.5 line-clamp-2 block text-[0.66rem] leading-snug text-white/45">{c.match}</span>}
                      </button>
                    )}
                    {renaming?.id !== c.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Options for ${c.title}`}
                            className="mr-1 rounded p-1 text-white/50 opacity-0 transition-opacity hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover/conv:opacity-100 data-[state=open]:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setRenaming({ id: c.id, value: c.title })}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              await store.setPinned(c.id, !c.pinned);
                              if (c.id === activeId) setPinned(!c.pinned);
                            }}
                          >
                            {c.pinned ? <PinOff className="mr-2 h-3.5 w-3.5" /> : <Pin className="mr-2 h-3.5 w-3.5" />} {c.pinned ? "Unpin" : "Pin"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const conv = await store.load(c.id);
                              if (conv) void runExport(`conv-${c.id}`, () => downloadReport("pdf", "conversation", conv.title, conversationItems(conv.messages)));
                            }}
                          >
                            <Download className="mr-2 h-3.5 w-3.5" /> Export as PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete(c)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            ))
          )
        ) : saved.length === 0 ? (
          <p className="px-3 py-6 text-center text-[0.75rem] leading-relaxed text-white/50">
            Save important responses with the <Bookmark className="inline h-3 w-3" /> button under an answer to keep them here.
          </p>
        ) : (
          <div className="mt-1 space-y-1.5 px-1">
            {saved.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void openConversation(s.conversationId, s.id)}
                className="block w-full rounded-lg border border-white/10 bg-white/[0.04] p-2.5 text-left transition-colors hover:border-[var(--gold-400)]/40 hover:bg-white/[0.08]"
              >
                <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--gold-300)]">{s.conversationTitle}</p>
                <p className="mt-1 line-clamp-3 text-[0.74rem] leading-snug text-white/80">{s.content.replace(/[#*[\]]/g, "").replace(/\s+/g, " ")}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3 text-[0.68rem] leading-relaxed text-white/55">
        {store.mode === "account" ? (
          <p>
            <ShieldCheck className="mr-1 inline h-3 w-3 text-[var(--gold-300)]" />
            Saved to your account. Conversations inactive for {Math.round(store.retentionDays / 30)} months are deleted, in line with the journal&apos;s{" "}
            <button type="button" onClick={() => { setView("privacy"); onOpenChange(false); }} className="underline decoration-white/30 underline-offset-2 hover:text-white">
              privacy policy
            </button>
            .
          </p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-2">
              <span>Keep history in this browser</span>
              <Switch checked={store.deviceEnabled} onCheckedChange={store.setDeviceHistory} aria-label="Keep conversation history in this browser" />
            </label>
            <p>
              Stored only on this device, never on our servers, for up to 12 months.{" "}
              {store.list.length > 0 && (
                <button type="button" onClick={store.clearDevice} className="underline decoration-white/30 underline-offset-2 hover:text-white">
                  Clear all
                </button>
              )}
            </p>
            <p className="text-white/45">Sign in to sync conversations across devices.</p>
          </div>
        )}
      </div>
    </div>
  );

  // ---- Main --------------------------------------------------------------
  const conversationActions = messages.some((m) => m.role === "assistant");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex bg-background outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.985] sm:inset-3 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            textareaRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{journalName} — AI Research Assistant</DialogPrimitive.Title>

          <aside className="hidden w-[272px] flex-shrink-0 lg:block" aria-label="Conversations">
            {sidebar}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar */}
            <header className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-3 sm:px-5">
              <button
                type="button"
                onClick={() => setMobileSidebar(true)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
                aria-label="Open conversations"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[0.95rem] font-semibold text-foreground">{title}</p>
                <p className="hidden truncate text-[0.66rem] text-muted-foreground sm:block">
                  AI Research Assistant · answers only from {journalName}&apos;s published articles
                </p>
              </div>
              {activeId && (
                <button
                  type="button"
                  onClick={async () => {
                    await store.setPinned(activeId, !pinned);
                    setPinned(!pinned);
                  }}
                  className={cn("hidden rounded-md p-2 transition-colors hover:bg-muted sm:inline-flex", pinned ? "text-[var(--gold-600)]" : "text-muted-foreground hover:text-foreground")}
                  aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
                  title={pinned ? "Unpin conversation" : "Pin conversation"}
                >
                  {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
              )}
              {activeId && (
                <button
                  type="button"
                  onClick={() => setRenaming({ id: activeId, value: title })}
                  className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
                  aria-label="Rename conversation"
                  title="Rename conversation"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {conversationActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      aria-label="Export conversation"
                    >
                      {exporting === "conversation" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">Export</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="text-xs">Export this conversation</DropdownMenuLabel>
                    {(
                      [
                        ["pdf", "PDF research report"],
                        ["docx", "Word document (.docx)"],
                        ["md", "Markdown (.md)"],
                      ] as const
                    ).map(([format, label]) => (
                      <DropdownMenuItem
                        key={format}
                        onClick={() => void runExport("conversation", () => downloadReport(format, "conversation", title, conversationItems(messages)))}
                      >
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                type="button"
                onClick={resetConversation}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                aria-label="New conversation"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => (window.matchMedia(WIDE).matches ? setEvidenceOpen((v) => !v) : setMobileEvidence(true))}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={evidenceOpen ? "Hide evidence panel" : "Show evidence panel"}
                title="Evidence panel"
              >
                <span className="hidden xl:inline">{evidenceOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}</span>
                <FileSearch className="h-4 w-4 xl:hidden" />
              </button>
              <DialogPrimitive.Close className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close Research Assistant">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </header>

            {renaming && renaming.id === activeId && (
              <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-5 py-2">
                <input
                  autoFocus
                  value={renaming.value}
                  onChange={(e) => setRenaming({ id: renaming.id, value: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      await store.rename(renaming.id, renaming.value);
                      setTitle(renaming.value.trim() || title);
                      setRenaming(null);
                    }
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  maxLength={120}
                  aria-label="Conversation name"
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await store.rename(renaming.id, renaming.value);
                    setTitle(renaming.value.trim() || title);
                    setRenaming(null);
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Save
                </button>
              </div>
            )}

            <div className="flex min-h-0 flex-1">
              {/* Conversation */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div ref={scrollRef} className="flex-1 overflow-y-auto epip-scroll">
                  <div className="mx-auto w-full max-w-[46rem] px-4 pb-8 pt-6 sm:px-6">
                    {notice && (
                      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-900 dark:text-amber-200" role="alert">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>{notice}</p>
                      </div>
                    )}

                    {messages.length === 0 && !busy ? (
                      <div className="pt-4 sm:pt-10">
                        <div className="group float-right ml-4 hidden sm:block" aria-hidden="true">
                          <ResearchMascot size={104} />
                        </div>
                        <div className="group mb-3 sm:hidden" aria-hidden="true">
                          <ResearchMascot size={64} />
                        </div>
                        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-[var(--gold-600)]">AI Research Assistant</p>
                        <h1 className="mt-2 font-display text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.2rem]">
                          Ask the journal&apos;s published research.
                        </h1>
                        <p className="mt-3 max-w-xl text-[0.92rem] leading-relaxed text-muted-foreground">
                          Answers are drawn only from {journalName}
                          {articleCount ? `'s ${articleCount} published article${articleCount === 1 ? "" : "s"}` : "'s published articles"}
                          {journal?.issn ? ` (ISSN ${journal.issn})` : ""}, with every claim cited to the passage it comes from.
                        </p>
                        <ul className="mt-5 grid gap-2 sm:grid-cols-3">
                          {[
                            { icon: BookOpenText, title: "Journal-only evidence", text: "No outside sources or invented details." },
                            { icon: Quote, title: "Every claim cited", text: "Click a number to see the exact passage." },
                            { icon: ShieldCheck, title: "Evidence-checked", text: "DOIs, quotes and figures verified." },
                          ].map((g) => (
                            <li key={g.title} className="rounded-xl border border-border/80 bg-card/60 p-3">
                              <g.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                              <p className="mt-1.5 text-[0.8rem] font-semibold text-foreground">{g.title}</p>
                              <p className="text-[0.72rem] leading-snug text-muted-foreground">{g.text}</p>
                            </li>
                          ))}
                        </ul>

                        {promptGroups.length > 0 && (
                          <div className="mt-8 space-y-5">
                            {promptGroups.map(([category, items]) => {
                              const Icon = PROMPT_ICONS[category];
                              return (
                                <section key={category} aria-label={category}>
                                  <p className="mb-2 flex items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    <Icon className="h-3.5 w-3.5 text-[var(--gold-600)]" aria-hidden="true" /> {category}
                                  </p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {items.map((p) => (
                                      <button
                                        key={p.question}
                                        type="button"
                                        onClick={() => void ask(p.question)}
                                        className="group rounded-xl border border-border/80 bg-card/70 px-3.5 py-3 text-left text-[0.82rem] leading-snug text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      >
                                        {p.question}
                                      </button>
                                    ))}
                                  </div>
                                </section>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-7">
                        {messages.map((m) =>
                          m.role === "user" ? (
                            <div key={m.id} id={`msg-${m.id}`} className="flex justify-end">
                              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--royal-50)] px-4 py-2.5 text-[0.9rem] leading-relaxed text-foreground ring-1 ring-[var(--royal-200)]/60 dark:bg-[var(--royal-100)]">
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              </div>
                            </div>
                          ) : (
                            <div
                              key={m.id}
                              id={`msg-${m.id}`}
                              className={cn(
                                "rounded-2xl border bg-card px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_24px_-16px_rgba(42,20,88,0.25)] transition-colors sm:px-5",
                                selection?.messageId === m.id ? "border-primary/30" : "border-border/80",
                                busy?.kind === "regenerate" && busy.id === m.id && "opacity-60"
                              )}
                            >
                              <AnswerView
                                message={m}
                                actions={actionsFor(m)}
                                busy={!!busy}
                                exporting={exporting === m.id}
                                isLatest={busy?.kind === "regenerate" && busy.id === m.id}
                              />
                            </div>
                          )
                        )}
                        {busy?.kind === "ask" && <Thinking />}
                        {!busy && lastAssistant?.data && ((lastAssistant.data.suggestedQuestions?.length ?? 0) > 0 || (lastAssistant.data.sectionQuestions?.length ?? 0) > 0) && (
                          <div className="space-y-5 rounded-2xl border border-dashed border-border/90 p-4">
                            <SuggestionList label="Ask next" questions={lastAssistant.data.suggestedQuestions ?? []} onPick={(q) => void ask(q)} disabled={!!busy} />
                            <SectionPills
                              article={lastAssistant.data.sectionArticle}
                              sections={lastAssistant.data.sectionQuestions ?? []}
                              onPick={(q) => void ask(q)}
                              disabled={!!busy}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Composer */}
                <div className="flex-shrink-0 border-t border-border/70 bg-background/95 px-3 pb-3 pt-2.5 sm:px-6">
                  <div className="mx-auto w-full max-w-[46rem]">
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
                            ? "Ask a follow-up — “this article”, “the second study” and “those findings” are understood…"
                            : "Ask about a paper, compare studies, or explore a research topic…"
                        }
                        aria-label="Your research question"
                        className="max-h-[220px] min-h-[44px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[0.92rem] shadow-none focus-visible:ring-0"
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
                      <span className="truncate">Answers come only from the journal&apos;s articles and can still contain errors — check the cited passages.</span>
                      <span className="hidden flex-shrink-0 tabular-nums sm:inline">
                        Shift + Enter for a new line · {input.length}/{MAX_QUESTION}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evidence panel (wide screens) */}
              {evidenceOpen && (
                <aside className="hidden w-[360px] flex-shrink-0 border-l border-border/70 bg-muted/20 xl:block" aria-label="Evidence">
                  <EvidencePanel data={evidenceData} selection={selection ?? (selectedMessage ? { messageId: selectedMessage.id, citation: null } : null)} onSelect={setSelection} onOpenArticle={openArticle} />
                </aside>
              )}
            </div>
          </div>

          {/* Mobile drawers */}
          <Sheet open={mobileSidebar} onOpenChange={setMobileSidebar}>
            <SheetContent side="left" className="w-[290px] border-0 p-0 [&>button]:text-white">
              <SheetTitle className="sr-only">Conversations</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <Sheet open={mobileEvidence} onOpenChange={setMobileEvidence}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-md [&>button]:hidden">
              <SheetTitle className="sr-only">Evidence</SheetTitle>
              <EvidencePanel
                data={evidenceData}
                selection={selection ?? (selectedMessage ? { messageId: selectedMessage.id, citation: null } : null)}
                onSelect={setSelection}
                onOpenArticle={openArticle}
                onClose={() => setMobileEvidence(false)}
              />
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

          <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{confirmDelete?.title}” and its saved responses will be permanently deleted. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!confirmDelete) return;
                    try {
                      await store.remove(confirmDelete.id);
                      if (confirmDelete.id === activeId) resetConversation();
                      toast.success("Conversation deleted.");
                    } catch {
                      toast.error("The conversation couldn't be deleted.");
                    }
                    setConfirmDelete(null);
                  }}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
