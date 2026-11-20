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
//   an article preview with the exact supporting passage (a bottom sheet
//   on phones, so the answer stays in view).
//
// Answers stream their real progress (understanding, searching, reading N
// passages, writing, checking) and can be stopped; the composer stays
// usable while an answer is prepared. Readers can narrow the search
// (disciplines, years, an issue, chosen articles), edit and resend a
// question, branch a conversation, share a read-only link, file saved
// responses in collections and export them as a notebook, and download an
// answer's sources for a reference manager. Keyboard shortcuts: press ?.
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
  FolderOpen,
  GitCompareArrows,
  Keyboard,
  Layers,
  Link2,
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
  ListChecks,
  Square,
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
  LiveAnswer,
  toAnswerData,
  type ApiAnswer,
  type StageState,
} from "@/components/research-assistant/chat-parts";
import { askStream, AskError } from "@/components/research-assistant/stream";
import { ScopePicker, isScopeEmpty, scopeChips } from "@/components/research-assistant/scope-picker";
import { CollectionDialog, ShareDialog, ShortcutsDialog } from "@/components/research-assistant/dialogs";
import { localId, titleFrom, useConversations } from "@/components/research-assistant/use-conversations";
import {
  answerAsText,
  citationsText,
  conversationItems,
  copyText,
  downloadCitations,
  downloadReport,
  exportItem,
  notebookItems,
} from "@/components/research-assistant/actions";
import type {
  AnswerData,
  AnswerSource,
  AssistantQuota,
  ChatMessage,
  ConversationSummary,
  CorpusScope,
  JournalMasthead,
  SavedResponse,
  ScopeFacets,
  StarterPrompt,
} from "@/components/research-assistant/types";

const MAX_QUESTION = 800;
const WIDE = "(min-width: 1280px)";
const SMALL = "(max-width: 639px)";
/** How long "Undo" is offered after deleting a conversation. */
const UNDO_MS = 6000;

/** True while the reader is typing in a field (so single-key shortcuts don't fire). */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function resetTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "shortly" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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
  "Suggested by the editors": ListChecks,
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
  const [facets, setFacets] = useState<ScopeFacets | null>(null);
  const [assistant, setAssistant] = useState<{ enabled: boolean; disclaimer: string | null }>({ enabled: true, disclaimer: null });

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [title, setTitle] = useState("New conversation");
  const [pinned, setPinned] = useState(false);
  const [shared, setShared] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<null | { kind: "ask" } | { kind: "regenerate"; id: string }>(null);
  const [stage, setStage] = useState<StageState | null>(null);
  /** The answer text streamed so far, shown while it is being written. */
  const [liveText, setLiveText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [continueOf, setContinueOf] = useState<{ question: string; evidenceIds: string[] } | null>(null);
  const [scope, setScope] = useState<CorpusScope>({});
  const [scopeTitles, setScopeTitles] = useState<Record<string, string>>({});
  const [scopeOpen, setScopeOpen] = useState(false);
  const [quota, setQuota] = useState<AssistantQuota | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const [search, setSearch] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"history" | "saved">("history");
  const [saved, setSavedList] = useState<SavedResponse[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [mobileEvidence, setMobileEvidence] = useState(false);
  const [small, setSmall] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<ChatMessage | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const renameCancelled = useRef(false);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [collectionFor, setCollectionFor] = useState<{ conversationId: string; messageId: string; current: string | null } | null>(null);
  const [shareState, setShareState] = useState<{ open: boolean; url: string | null; creating: boolean }>({ open: false, url: null, creating: false });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Phones get the evidence as a bottom sheet so the answer stays in view.
  useEffect(() => {
    const mq = window.matchMedia(SMALL);
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Masthead, starter prompts, scope options and the institution's settings, once the assistant is first opened.
  useEffect(() => {
    if (!open || journal) return;
    let cancelled = false;
    apiFetch<{
      journal?: JournalMasthead;
      stats?: { articles: number | null };
      prompts?: StarterPrompt[];
      facets?: ScopeFacets;
      assistant?: { enabled: boolean; disclaimer: string | null };
    }>("/api/corpus-chat")
      .then((res) => {
        if (cancelled) return;
        if (res.journal) setJournal(res.journal);
        setArticleCount(res.stats?.articles ?? null);
        if (Array.isArray(res.prompts)) setPrompts(res.prompts);
        if (res.facets) setFacets(res.facets);
        if (res.assistant) setAssistant(res.assistant);
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

  const refreshSaved = useCallback(() => {
    void store.savedResponses(folderFilter).then((r) => {
      setSavedList(r.saved);
      setFolders(r.folders);
      if (folderFilter && !r.folders.includes(folderFilter)) setFolderFilter(null);
    });
  }, [store, folderFilter]);

  useEffect(() => {
    if (sidebarTab === "saved" && open) refreshSaved();
  }, [sidebarTab, open, refreshSaved]);

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

  // Deletions still waiting out their "Undo" period complete if the panel goes away.
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);
  useEffect(() => {
    const timers = deleteTimers.current;
    return () => {
      for (const [id, t] of timers) {
        clearTimeout(t);
        void storeRef.current.remove(id).catch(() => {});
      }
      timers.clear();
    };
  }, []);

  const journalName = withTrademark(journal?.name) ?? branding.siteName ?? JOURNAL_IDENTITY.name;
  // The publishing house shown in full at the top of the sidebar.
  const publisherName = withTrademark(journal?.publisher) || branding.siteName || JOURNAL_IDENTITY.name;
  const selectedMessage = messages.find((m) => m.id === selection?.messageId && m.role === "assistant") ?? [...messages].reverse().find((m) => m.role === "assistant");
  const evidenceData = selectedMessage?.data ?? null;
  const lastMessage = messages[messages.length - 1];
  const lastAssistant = lastMessage?.role === "assistant" ? lastMessage : undefined;
  const scopeActive = !isScopeEmpty(scope);

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
    abortRef.current?.abort();
    setActiveId(null);
    setTitle("New conversation");
    setPinned(false);
    setShared(false);
    setMessages([]);
    setSelection(null);
    setNotice(null);
    setContinueOf(null);
    setEditing(null);
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
      abortRef.current?.abort();
      setActiveId(c.id);
      setTitle(c.title);
      setPinned(c.pinned);
      setShared(!!c.shared);
      setMessages(c.messages.map((m) => ({ ...m })));
      setRevealId(null);
      const target = focusMessageId ?? [...c.messages].reverse().find((m) => m.role === "assistant")?.id;
      setSelection(target ? { messageId: target, citation: null } : null);
      setNotice(null);
      setContinueOf(null);
      setEditing(null);
      setMobileSidebar(false);
      if (focusMessageId) {
        setTimeout(() => document.getElementById(`msg-${focusMessageId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      }
    },
    [store]
  );

  /** Stops the answer being prepared (the request is cancelled on the server too). */
  const stop = useCallback(() => {
    if (!abortRef.current) return;
    abortRef.current.abort();
    setAnnouncement("Stopped.");
  }, []);

  /**
   * Asks a question. `base` is the conversation it follows (all messages by
   * default; "Edit and resend" passes the messages before the edited
   * question). `scopeOverride` asks with a different scope once.
   */
  async function ask(text: string, opts: { base?: ChatMessage[]; scopeOverride?: CorpusScope } = {}) {
    const question = text.trim();
    if (!question) return;
    if (busy) {
      toast.info("An answer is still being prepared. Press Esc or Stop to cancel it, or wait — your draft is kept.");
      return;
    }
    if (!assistant.enabled) return;
    if (question.length > MAX_QUESTION) {
      toast.error(`Questions can be up to ${MAX_QUESTION} characters.`);
      return;
    }
    const base = opts.base ?? messages;
    const askScope = opts.scopeOverride ?? scope;
    const sendScope = isScopeEmpty(askScope) ? null : askScope;
    const continuing = continueOf;
    const prior = history(base);
    const userMsg: ChatMessage = { id: localId(), role: "user", content: question, createdAt: new Date().toISOString() };
    setMessages([...base, userMsg]);
    if (input.trim() === question) setInput("");
    setContinueOf(null);
    setEditing(null);
    setBusy({ kind: "ask" });
    setStage({ stage: "sending" });
    setLiveText("");
    let streamed = false;
    setNotice(null);
    setAnnouncement("Preparing an answer…");
    const controller = new AbortController();
    abortRef.current = controller;
    const restore = () => {
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput((cur) => (cur.trim() ? cur : question));
    };
    try {
      const res = await askStream(
        {
          question,
          history: prior,
          ...(sendScope ? { scope: sendScope } : {}),
          ...(continuing ? { continueOf: continuing } : {}),
        },
        {
          signal: controller.signal,
          onStage: setStage,
          onDelta: (t) => {
            streamed = true;
            setLiveText((prev) => prev + t);
          },
        }
      );
      if (res.quota) setQuota(res.quota);
      if (res.mode === "answered" && res.answer) {
        const data: AnswerData = { ...toAnswerData(res), scope: sendScope, continued: continuing?.question ?? null };
        const answerMsg: ChatMessage = { id: localId(), role: "assistant", content: res.answer, createdAt: new Date().toISOString(), data };
        setMessages((prev) => [...prev, answerMsg]);
        // Already watched being written: no second, simulated reveal.
        if (!streamed) setRevealId(answerMsg.id);
        setSelection({ messageId: answerMsg.id, citation: null });
        setAnnouncement(
          data.grounded
            ? `Answer ready, citing ${data.sources.length} source${data.sources.length === 1 ? "" : "s"}.`
            : "Answer ready: the journal's articles don't cover this question."
        );
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
            setRevealId((r) => (r === answerMsg.id ? stored.answerId : r));
          }
        } else if (store.mode === "account") {
          toast.error("This answer couldn't be saved to your conversation history.");
        }
      } else if (res.mode === "stopped") {
        restore();
      } else {
        const msg = res.message || "The Research Assistant isn't available right now.";
        setNotice(msg);
        setAnnouncement(msg);
        if (res.mode === "disabled") setAssistant((a) => ({ ...a, enabled: false }));
        restore();
      }
    } catch (e: any) {
      if (controller.signal.aborted || e?.name === "AbortError") {
        restore();
        toast("Stopped. Your question is back in the box to edit or send again.");
      } else {
        const status: number | undefined = e instanceof AskError ? e.status : e?.status;
        if (status === 429) {
          const q = (e as AskError).body?.quota as AssistantQuota | undefined;
          if (q) setQuota(q);
          setNotice(`${e.message}${q?.resetAt ? ` (resets at ${resetTime(q.resetAt)})` : ""}`);
        } else if (status && status >= 400 && status < 500 && e?.message) toast.error(e.message);
        else setNotice("The Research Assistant is temporarily unavailable. Please try again in a few minutes.");
        restore();
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
      setStage(null);
      setLiveText("");
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
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await askStream(
        {
          question: q.content,
          history: history(messages.slice(0, qi)),
          regenerate: true,
          evidenceIds: answer.data?.evidenceIds ?? [],
          ...(answer.data?.scope ? { scope: answer.data.scope } : {}),
        },
        { signal: controller.signal }
      );
      if (res.quota) setQuota(res.quota);
      if (res.mode === "answered" && res.answer) {
        const data: AnswerData = { ...toAnswerData(res), scope: answer.data?.scope ?? null, continued: answer.data?.continued ?? null };
        setMessages((prev) => prev.map((m) => (m.id === answer.id ? { ...m, content: res.answer!, data } : m)));
        setRevealId(answer.id);
        setSelection({ messageId: answer.id, citation: null });
        if (activeIdRef.current) await store.updateAnswer(activeIdRef.current, answer.id, res.answer, data);
        toast.success("Regenerated from the same evidence.");
      } else if (res.mode !== "stopped") {
        toast.error(res.message || "The answer couldn't be regenerated right now.");
      }
    } catch (e: any) {
      if (!controller.signal.aborted) toast.error(e?.status && e.status < 500 && e.message ? e.message : "The answer couldn't be regenerated right now.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  }

  /** Replaces a question with an edited one and answers it again; later messages are removed. */
  async function editAndResend(messageId: string, text: string) {
    const i = messages.findIndex((m) => m.id === messageId);
    if (i === -1 || !text.trim() || busy) return;
    if (activeIdRef.current) await store.truncateFrom(activeIdRef.current, messageId);
    setSelection(null);
    await ask(text, { base: messages.slice(0, i), scopeOverride: messages[i + 1]?.data?.scope ?? scope });
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

  async function runExport(key: string, fn: () => Promise<void>, done = "Your report is downloading.") {
    setExporting(key);
    try {
      await fn();
      toast.success(done);
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

  const mergeScopeTitles = useCallback((t: Record<string, string>) => setScopeTitles((prev) => ({ ...prev, ...t })), []);

  const scopeToArticle = useCallback((source: AnswerSource) => {
    setScope({ articleIds: [source.id] });
    setScopeTitles((t) => ({ ...t, [source.id]: source.title }));
    setMobileEvidence(false);
    toast.success(`Your next questions search only “${source.title}”. Clear the scope above the question box to search the whole journal.`);
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, []);

  /** Deletes a conversation after a short "Undo" window. */
  const deleteConversation = useCallback(
    (c: ConversationSummary) => {
      setPendingDeletes((p) => [...p, c.id]);
      if (c.id === activeIdRef.current) resetConversation();
      const commit = async () => {
        deleteTimers.current.delete(c.id);
        try {
          await store.remove(c.id);
        } catch {
          toast.error("The conversation couldn't be deleted.");
        }
        setPendingDeletes((p) => p.filter((x) => x !== c.id));
      };
      deleteTimers.current.set(c.id, setTimeout(() => void commit(), UNDO_MS));
      toast(`Deleted “${c.title}”`, {
        duration: UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            const t = deleteTimers.current.get(c.id);
            if (t) clearTimeout(t);
            deleteTimers.current.delete(c.id);
            setPendingDeletes((p) => p.filter((x) => x !== c.id));
            toast.success("Conversation restored.");
          },
        },
      });
    },
    [store, resetConversation]
  );

  const saveRename = useCallback(
    async (id: string, value: string) => {
      if (renameCancelled.current) {
        renameCancelled.current = false;
        return;
      }
      const clean = value.trim();
      setRenaming(null);
      if (!clean) return;
      try {
        await store.rename(id, clean);
        if (id === activeIdRef.current) setTitle(clean);
      } catch {
        toast.error("The conversation couldn't be renamed.");
      }
    },
    [store]
  );

  const cancelRename = useCallback(() => {
    renameCancelled.current = true;
    setRenaming(null);
    // A blur can follow the Escape; reset the flag after it.
    setTimeout(() => {
      renameCancelled.current = false;
    }, 0);
  }, []);

  async function openShare() {
    if (!activeIdRef.current) return;
    if (store.mode !== "account") {
      toast.info("Sign in to share a read-only link to a conversation.");
      return;
    }
    setShareState({ open: true, url: null, creating: true });
    const url = await store.share(activeIdRef.current);
    if (!url) {
      setShareState({ open: false, url: null, creating: false });
      toast.error("The share link couldn't be created. Please try again.");
      return;
    }
    setShared(true);
    setShareState({ open: true, url, creating: false });
  }

  async function branchFrom(m: ChatMessage) {
    if (!activeIdRef.current) {
      toast.info("Branching is available once the conversation is saved.");
      return;
    }
    const id = await store.branch(activeIdRef.current, m.id);
    if (!id) {
      toast.error("The conversation couldn't be branched. Please try again.");
      return;
    }
    await openConversation(id);
    toast.success("Branched into a new conversation. The original is unchanged.");
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

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
      onExportCitations: (format) =>
        void runExport(
          `cite-${m.id}`,
          () => downloadCitations(m.data?.sources.map((s) => s.id) ?? [], format),
          `Sources downloaded as ${format === "ris" ? "RIS" : "BibTeX"}. Import the file into your reference manager.`
        ),
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
        if (sidebarTab === "saved") refreshSaved();
      },
      onAddToCollection: activeIdRef.current
        ? () => {
            void store.savedResponses().then((r) => setFolders(r.folders));
            setCollectionFor({ conversationId: activeIdRef.current!, messageId: m.id, current: m.folder ?? null });
          }
        : undefined,
      onBranch: activeIdRef.current ? () => void branchFrom(m) : undefined,
      onFeedback: (rating) => {
        if (m.data?.feedback === rating) return;
        sendFeedback(m, rating)
          .then(() => toast.success(rating === "HELPFUL" ? "Thanks — glad it helped." : "Thanks for the feedback. It helps the editors improve the assistant."))
          .catch(() => toast.error("Feedback couldn't be sent. Please try again."));
      },
      onReport: () => setReportFor(m),
      onContinue: () => {
        const q = questionFor(m);
        if (!q) return;
        setContinueOf({ question: q.content, evidenceIds: m.data?.evidenceIds ?? [] });
        textareaRef.current?.focus();
      },
      onWidenScope: () => {
        const q = questionFor(m);
        setScope({});
        if (q) void ask(q.content, { scopeOverride: {} });
      },
    };
  }

  // ---- Keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const typing = isTyping(e.target);
      if (!typing && !e.altKey && !e.ctrlKey && !e.metaKey && e.key === "/") {
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }
      if (!typing && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.code === "KeyN") {
          e.preventDefault();
          resetConversation();
        } else if (e.code === "KeyE") {
          e.preventDefault();
          if (window.matchMedia(WIDE).matches) setEvidenceOpen((v) => !v);
          else setMobileEvidence((v) => !v);
        } else if (e.code === "KeyS") {
          e.preventDefault();
          setScopeOpen(true);
        } else if (e.key === "ArrowUp" && !busy) {
          const last = [...messages].reverse().find((m) => m.role === "user");
          if (last) {
            e.preventDefault();
            setEditing({ id: last.id, value: last.content });
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, messages, resetConversation]);

  const groups = useMemo(() => groupConversations(store.list.filter((c) => !pendingDeletes.includes(c.id))), [store.list, pendingDeletes]);
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
            {journalName !== publisherName && <p className="mt-1 text-xs leading-snug text-white/75 [overflow-wrap:anywhere]">{journalName}</p>}
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--gold-300)]">
              {journal?.issn ? `ISSN ${journal.issn}` : branding.tagline || "Peer-reviewed journal"}
            </p>
          </div>
        </div>
        <div className="group mt-4 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
          <span className="-my-1 flex h-11 w-10 items-end justify-center rounded-md bg-gradient-to-b from-[#bdf0ea]/25 to-transparent">
            <ResearchMascot size={36} state={busy ? "thinking" : "idle"} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.82rem] font-semibold leading-tight">AI Research Assistant</p>
            <p className="truncate text-xs text-white/70">
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
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSidebarTab("history");
            }}
            placeholder="Search conversations"
            aria-label="Search previous conversations"
            className="h-9 w-full rounded-md border border-white/15 bg-white/[0.07] pl-8 pr-2 text-[0.82rem] text-white placeholder:text-white/60 focus:border-[var(--gold-400)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-400)]/40"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.06] p-0.5 text-xs font-medium" role="tablist" aria-label="History">
          {(["history", "saved"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={sidebarTab === tab}
              onClick={() => setSidebarTab(tab)}
              className={cn(
                "rounded-md py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-400)]/60",
                sidebarTab === tab ? "bg-white/15 text-white" : "text-white/70 hover:text-white"
              )}
            >
              {tab === "history" ? "Conversations" : "Saved responses"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-3 epip-scroll">
        {sidebarTab === "history" ? (
          groups.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquarePlus className="mx-auto mb-2 h-6 w-6 text-white/40" aria-hidden="true" />
              <p className="text-[0.8rem] leading-relaxed text-white/70">
                {search ? "No conversations match your search." : "Your conversations will appear here."}
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mt-2">
                <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/60">{g.label}</p>
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
                        onBlur={() => void saveRename(c.id, renaming.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        maxLength={120}
                        aria-label="Conversation name. Enter to save, Escape to cancel"
                        className="m-1 h-8 w-full rounded border border-[var(--gold-400)]/70 bg-white/10 px-2 text-[0.82rem] text-white focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => void openConversation(c.id)}
                        aria-current={c.id === activeId ? "true" : undefined}
                        className="min-w-0 flex-1 rounded-md px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-400)]/60"
                      >
                        <span className="flex items-center gap-1.5">
                          {c.pinned && <Pin className="h-3 w-3 flex-shrink-0 text-[var(--gold-300)]" aria-label="Pinned" />}
                          {c.shared && <Link2 className="h-3 w-3 flex-shrink-0 text-[var(--gold-300)]" aria-label="Shared" />}
                          <span className="truncate text-[0.84rem] text-white/90">{c.title}</span>
                        </span>
                        {c.match && <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-white/65">{c.match}</span>}
                      </button>
                    )}
                    {renaming?.id !== c.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Options for ${c.title}`}
                            className="mr-1 rounded p-1.5 text-white/65 opacity-0 transition-opacity hover:bg-white/10 hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-400)]/60 group-focus-within/conv:opacity-100 group-hover/conv:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
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
                          <DropdownMenuItem onClick={() => deleteConversation(c)} className="text-destructive focus:text-destructive">
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
        ) : (
          <div className="mt-1 space-y-2 px-1">
            {(folders.length > 0 || saved.length > 0) && (
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Collections">
                {[null, ...folders].map((f) => (
                  <button
                    key={f ?? "__all"}
                    type="button"
                    onClick={() => setFolderFilter(f)}
                    aria-pressed={folderFilter === f}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-400)]/60",
                      folderFilter === f ? "border-[var(--gold-400)] bg-[var(--gold-400)] font-semibold text-[#241b3a]" : "border-white/15 text-white/80 hover:border-white/35"
                    )}
                  >
                    {f && <FolderOpen className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
                    <span className="truncate">{f ?? "All saved"}</span>
                  </button>
                ))}
              </div>
            )}
            {saved.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/15 px-2 py-1.5 text-xs font-medium text-white/85 transition-colors hover:border-[var(--gold-400)]/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-400)]/60"
                  >
                    {exporting === "notebook" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Export {folderFilter ? `“${folderFilter}”` : "all saved"} as a notebook
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel className="text-xs">Literature notebook ({saved.length} response{saved.length === 1 ? "" : "s"})</DropdownMenuLabel>
                  {(
                    [
                      ["pdf", "PDF research report"],
                      ["docx", "Word document (.docx)"],
                      ["md", "Markdown (.md)"],
                    ] as const
                  ).map(([format, label]) => (
                    <DropdownMenuItem
                      key={format}
                      onClick={() =>
                        void runExport("notebook", () => downloadReport(format, "conversation", folderFilter ? `Notebook — ${folderFilter}` : "Research notebook", notebookItems(saved)))
                      }
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Every source cited, for a reference manager</DropdownMenuLabel>
                  {(["ris", "bibtex"] as const).map((format) => (
                    <DropdownMenuItem
                      key={format}
                      onClick={() =>
                        void runExport(
                          "notebook",
                          () => downloadCitations(saved.flatMap((x) => x.data?.sources.map((src) => src.id) ?? []), format),
                          `Sources downloaded as ${format === "ris" ? "RIS" : "BibTeX"}.`
                        )
                      }
                    >
                      {format === "ris" ? "RIS (Zotero, Mendeley, EndNote)" : "BibTeX (LaTeX, Zotero)"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {saved.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Bookmark className="mx-auto mb-2 h-6 w-6 text-white/40" aria-hidden="true" />
                <p className="text-[0.8rem] leading-relaxed text-white/70">
                  {folderFilter ? "Nothing in this collection yet." : "Save important responses with the bookmark button under an answer, and file them in collections."}
                </p>
              </div>
            ) : (
              saved.map((x) => (
                <div
                  key={x.id}
                  className="group/saved relative rounded-lg border border-white/10 bg-white/[0.05] transition-colors hover:border-[var(--gold-400)]/45 hover:bg-white/[0.08]"
                >
                  <button
                    type="button"
                    onClick={() => void openConversation(x.conversationId, x.id)}
                    className="block w-full rounded-lg p-2.5 pr-9 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-400)]/60"
                  >
                    <p className="flex items-center gap-1 truncate text-xs font-semibold uppercase tracking-[0.1em] text-[var(--gold-300)]">
                      {x.folder && <FolderOpen className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
                      <span className="truncate">{x.folder ?? x.conversationTitle}</span>
                    </p>
                    {x.question && <p className="mt-1 line-clamp-1 text-xs font-medium text-white/85">{x.question}</p>}
                    <p className="mt-0.5 line-clamp-3 text-[0.78rem] leading-snug text-white/75">{x.content.replace(/[#*[\]]/g, "").replace(/\s+/g, " ")}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionFor({ conversationId: x.conversationId, messageId: x.id, current: x.folder ?? null })}
                    aria-label={x.folder ? `Move to another collection (now in ${x.folder})` : "Add to a collection"}
                    title={x.folder ? "Change collection" : "Add to a collection"}
                    className="absolute right-1.5 top-1.5 rounded p-1.5 text-white/65 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-400)]/60"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3 text-xs leading-relaxed text-white/70">
        {store.mode === "account" ? (
          <p>
            <ShieldCheck className="mr-1 inline h-3 w-3 text-[var(--gold-300)]" />
            Saved to your account. Conversations inactive for{" "}
            {store.retentionDays < 60 ? `${store.retentionDays} days` : `${Math.round(store.retentionDays / 30)} months`} are deleted, in line with the journal&apos;s{" "}
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
            <p className="text-white/65">Sign in to sync conversations across devices, share links and get your own question quota.</p>
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
          onEscapeKeyDown={(e) => {
            // Escape first stops an answer or cancels an edit; only then closes the assistant.
            if (busy) {
              e.preventDefault();
              stop();
            } else if (renaming) {
              e.preventDefault();
              cancelRename();
            } else if (editing) {
              e.preventDefault();
              setEditing(null);
            }
          }}
        >
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </div>
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
                <p className="hidden truncate text-xs text-muted-foreground sm:block">
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
              {activeId && (
                <button
                  type="button"
                  onClick={() => void openShare()}
                  className={cn(
                    "hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors sm:inline-flex",
                    shared ? "border-primary/40 text-primary" : "border-border text-foreground hover:border-primary/40 hover:text-primary"
                  )}
                  aria-label={shared ? "Shared — manage the read-only link" : "Share a read-only link"}
                  title={store.mode === "account" ? "Share a read-only link" : "Sign in to share"}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{shared ? "Shared" : "Share"}</span>
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
                onClick={() => setShortcutsOpen(true)}
                className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="h-4 w-4" />
              </button>
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
                title="Evidence panel (Alt+E)"
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void saveRename(renaming.id, renaming.value);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  maxLength={120}
                  aria-label="Conversation name. Enter to save, Escape to cancel"
                  className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={cancelRename}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveRename(renaming.id, renaming.value)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Save
                </button>
              </div>
            )}

            <div className="flex min-h-0 flex-1">
              {/* Conversation */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div ref={scrollRef} className="flex-1 overflow-y-auto epip-scroll" aria-label="Conversation">
                  <div className="mx-auto w-full max-w-[46rem] px-4 pb-8 pt-6 sm:px-6">
                    {notice && (
                      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-900 dark:text-amber-200" role="alert">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>{notice}</p>
                      </div>
                    )}

                    {!assistant.enabled && messages.length === 0 ? (
                      <div className="flex flex-col items-center px-4 pt-16 text-center">
                        <ResearchMascot size={72} />
                        <h1 className="mt-4 font-display text-xl font-semibold text-foreground">The Research Assistant isn&apos;t available here</h1>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                          {journalName}&apos;s editors have switched it off for now. You can still browse and search the published articles.
                        </p>
                      </div>
                    ) : messages.length === 0 && !busy ? (
                      <div className="pt-4 sm:pt-10">
                        <div className="group float-right ml-4 hidden sm:block" aria-hidden="true">
                          <ResearchMascot size={104} />
                        </div>
                        <div className="group mb-3 sm:hidden" aria-hidden="true">
                          <ResearchMascot size={64} />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold-600)]">AI Research Assistant</p>
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
                              <p className="text-xs leading-snug text-muted-foreground">{g.text}</p>
                            </li>
                          ))}
                        </ul>

                        {promptGroups.length > 0 && (
                          <div className="mt-8 space-y-5">
                            {promptGroups.map(([category, items]) => {
                              const Icon = PROMPT_ICONS[category];
                              return (
                                <section key={category} aria-label={category}>
                                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                            editing?.id === m.id ? (
                              <form
                                key={m.id}
                                id={`msg-${m.id}`}
                                className="ml-auto w-full max-w-[85%] rounded-2xl border border-primary/40 bg-card p-2.5 shadow-sm"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  void editAndResend(m.id, editing.value);
                                }}
                              >
                                <Textarea
                                  autoFocus
                                  value={editing.value}
                                  onChange={(e) => setEditing({ id: m.id, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                      e.preventDefault();
                                      void editAndResend(m.id, editing.value);
                                    }
                                  }}
                                  maxLength={MAX_QUESTION}
                                  aria-label="Edit your question"
                                  className="min-h-[72px] resize-none border-0 bg-transparent text-[0.92rem] shadow-none focus-visible:ring-0 focus-visible:!outline-none"
                                />
                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                  <p className="text-xs text-muted-foreground">Later messages in this conversation will be replaced.</p>
                                  <div className="flex gap-1.5">
                                    <button type="button" onClick={() => setEditing(null)} className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={!editing.value.trim() || !!busy}
                                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                                    >
                                      Send
                                    </button>
                                  </div>
                                </div>
                              </form>
                            ) : (
                              <div key={m.id} id={`msg-${m.id}`} className="group/q flex items-start justify-end gap-1.5">
                                {!busy && (
                                  <button
                                    type="button"
                                    onClick={() => setEditing({ id: m.id, value: m.content })}
                                    className="mt-1.5 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/q:opacity-100 [@media(hover:none)]:opacity-100"
                                    aria-label="Edit and resend this question"
                                    title="Edit and resend"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--royal-50)] px-4 py-2.5 text-[0.92rem] leading-relaxed text-foreground ring-1 ring-[var(--royal-200)]/60 dark:bg-[var(--royal-100)]">
                                  <p className="whitespace-pre-wrap">{m.content}</p>
                                </div>
                              </div>
                            )
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
                                exporting={exporting === m.id || exporting === `cite-${m.id}`}
                                isLatest={busy?.kind === "regenerate" && busy.id === m.id}
                                reveal={revealId === m.id}
                              />
                            </div>
                          )
                        )}
                        {busy?.kind === "ask" && (
                          <div className="space-y-3">
                            <Thinking stage={stage} onStop={stop} />
                            {liveText.trim() && <LiveAnswer text={liveText} />}
                          </div>
                        )}
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
                    {continueOf && (
                      <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/[0.07] px-3 py-1.5 text-xs text-foreground">
                        <CornerDownRight className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">
                          Building on the analysis of: <span className="font-medium">{continueOf.question}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setContinueOf(null)}
                          className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground"
                          aria-label="Don't continue the earlier analysis"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {scopeActive && (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Search scope">
                        <span className="text-xs font-medium text-muted-foreground">Searching only:</span>
                        {scopeChips(scope, facets, scopeTitles).map((chip) => (
                          <span
                            key={chip.key}
                            className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.06] py-0.5 pl-2.5 pr-1 text-xs text-foreground"
                          >
                            <span className="truncate">{chip.label}</span>
                            <button
                              type="button"
                              onClick={() => setScope(chip.without)}
                              className="rounded-full p-0.5 text-muted-foreground hover:bg-primary/15 hover:text-foreground"
                              aria-label={`Remove ${chip.label} from the scope`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <button type="button" onClick={() => setScope({})} className="text-xs font-medium text-primary hover:underline">
                          Search the whole journal
                        </button>
                      </div>
                    )}
                    <div className="rounded-2xl border border-border bg-card px-3 pb-2 pt-1.5 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
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
                          !assistant.enabled
                            ? "The Research Assistant isn't available on this site."
                            : continueOf
                              ? "Ask what to explore next — “this article”, “the second study” and “those findings” are understood…"
                              : "Ask about a paper, compare studies, or explore a research topic…"
                        }
                        aria-label="Your research question"
                        aria-describedby="composer-hint"
                        className="max-h-[220px] min-h-[44px] w-full resize-none border-0 bg-transparent px-1 py-2 text-[0.95rem] shadow-none focus-visible:ring-0 focus-visible:!outline-none"
                        rows={1}
                        maxLength={MAX_QUESTION}
                        disabled={!assistant.enabled}
                      />
                      <div className="flex items-center gap-2">
                        <ScopePicker
                          scope={scope}
                          onChange={setScope}
                          facets={facets}
                          titles={scopeTitles}
                          onTitles={mergeScopeTitles}
                          disabled={!assistant.enabled}
                          open={scopeOpen}
                          onOpenChange={setScopeOpen}
                        />
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
                          {input.length > MAX_QUESTION * 0.8 ? `${input.length}/${MAX_QUESTION}` : ""}
                        </span>
                        {busy ? (
                          <button
                            type="button"
                            onClick={stop}
                            className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-destructive/40 hover:text-destructive"
                            aria-label="Stop the answer (Esc)"
                            title="Stop (Esc)"
                          >
                            <Square className="h-3.5 w-3.5 fill-current" /> Stop
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void ask(input)}
                            disabled={!input.trim() || !assistant.enabled}
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground"
                            aria-label="Send question"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div id="composer-hint" className="mt-1.5 flex flex-col gap-0.5 px-1 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <span>
                        Answers come only from the journal&apos;s articles and can still contain errors — check the cited passages.
                        {assistant.disclaimer ? ` ${assistant.disclaimer}` : ""}
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-2 tabular-nums">
                        {quota && (
                          <span className={cn(quota.remaining <= 5 && "font-medium text-amber-700 dark:text-amber-300")} title={`Resets at ${resetTime(quota.resetAt)}`}>
                            {quota.remaining} of {quota.limit} questions left this hour{quota.basis === "network" && quota.remaining <= 5 ? " · sign in for your own quota" : ""}
                          </span>
                        )}
                        <span className="hidden md:inline">
                          <button type="button" onClick={() => setShortcutsOpen(true)} className="underline decoration-border underline-offset-2 hover:text-foreground">
                            Shortcuts
                          </button>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evidence panel (wide screens) */}
              {evidenceOpen && (
                <aside className="hidden w-[360px] flex-shrink-0 border-l border-border/70 bg-muted/20 xl:block" aria-label="Evidence">
                  <EvidencePanel
                    data={evidenceData}
                    selection={selection ?? (selectedMessage ? { messageId: selectedMessage.id, citation: null } : null)}
                    onSelect={setSelection}
                    onOpenArticle={openArticle}
                    onScopeToArticle={scopeToArticle}
                  />
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
            <SheetContent
              side={small ? "bottom" : "right"}
              className={cn(
                "gap-0 p-0 [&>button:last-child]:hidden",
                small ? "h-[70dvh] rounded-t-2xl border-t" : "w-full sm:max-w-md"
              )}
            >
              <SheetTitle className="sr-only">Evidence</SheetTitle>
              {small && (
                <button
                  type="button"
                  onClick={() => setMobileEvidence(false)}
                  className="mx-auto mt-2 block h-1.5 w-12 rounded-full bg-border"
                  aria-label="Close evidence"
                />
              )}
              <div className="min-h-0 flex-1">
                <EvidencePanel
                  data={evidenceData}
                  selection={selection ?? (selectedMessage ? { messageId: selectedMessage.id, citation: null } : null)}
                  onSelect={setSelection}
                  onOpenArticle={openArticle}
                  onClose={() => setMobileEvidence(false)}
                  onScopeToArticle={scopeToArticle}
                />
              </div>
            </SheetContent>
          </Sheet>

          <ReportIssueDialog
            key={reportFor?.id ?? "report-closed"}
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

          <CollectionDialog
            key={collectionFor?.messageId ?? "collection-closed"}
            open={!!collectionFor}
            onOpenChange={(o) => !o && setCollectionFor(null)}
            current={collectionFor?.current ?? null}
            folders={folders}
            onSubmit={async (folder) => {
              if (!collectionFor) return;
              const ok = await store.setFolder(collectionFor.conversationId, collectionFor.messageId, folder);
              if (!ok) {
                toast.error("That couldn't be saved. Please try again.");
                throw new Error("collection failed");
              }
              setMessages((prev) =>
                prev.map((x) => (x.id === collectionFor.messageId ? { ...x, folder, saved: folder ? true : x.saved } : x))
              );
              toast.success(folder ? `Saved to “${folder}”.` : "Removed from its collection.");
              refreshSaved();
            }}
          />

          <ShareDialog
            open={shareState.open}
            onOpenChange={(o) => setShareState((st) => ({ ...st, open: o }))}
            url={shareState.url}
            creating={shareState.creating}
            onRevoke={async () => {
              if (!activeIdRef.current) return;
              const ok = await store.unshare(activeIdRef.current);
              if (ok) {
                setShared(false);
                toast.success("Sharing stopped. The link no longer works.");
              } else toast.error("Sharing couldn't be stopped. Please try again.");
            }}
          />

          <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
