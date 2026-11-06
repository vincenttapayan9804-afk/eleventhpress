"use client";

/**
 * Conversation storage for the Research Assistant, behind one interface:
 *
 * - Signed-in readers ("account"): saved to their account through
 *   /api/corpus-chat/conversations, so history follows them across
 *   devices, is included in their data export and deleted with their
 *   account.
 * - Everyone else ("device"): kept only in this browser's local storage
 *   (key "epip-research-assistant"), never sent to the server, and can be
 *   switched off or cleared.
 *
 * Both follow the journal's retention period: conversations with no
 * activity for a year are deleted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { AnswerData, ChatMessage, Conversation, ConversationSummary, SavedResponse } from "./types";

const STORAGE_KEY = "epip-research-assistant";
const DEVICE_RETENTION_DAYS = 365;
const DEVICE_MAX_CONVERSATIONS = 50;

interface DeviceState {
  v: 1;
  enabled: boolean;
  conversations: Conversation[];
}

function readDevice(): DeviceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeviceState;
      if (parsed?.v === 1 && Array.isArray(parsed.conversations)) {
        const cutoff = Date.now() - DEVICE_RETENTION_DAYS * 86_400_000;
        return {
          ...parsed,
          conversations: parsed.conversations.filter((c) => new Date(c.updatedAt).getTime() >= cutoff),
        };
      }
    }
  } catch {
    // Storage blocked or corrupt: start empty.
  }
  return { v: 1, enabled: true, conversations: [] };
}

function writeDevice(state: DeviceState) {
  try {
    if (!state.enabled) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, enabled: false, conversations: [] }));
      return;
    }
    const sorted = sortConversations(state.conversations);
    // Keep pinned ones, then the most recent, within the cap.
    const kept = [...sorted.filter((c) => c.pinned), ...sorted.filter((c) => !c.pinned)].slice(0, DEVICE_MAX_CONVERSATIONS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, conversations: kept }));
  } catch {
    // Quota exceeded or storage blocked: history stays in memory only.
  }
}

function sortConversations<T extends ConversationSummary>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

function summary(c: Conversation): ConversationSummary {
  const { messages, ...rest } = c;
  return { ...rest, messageCount: messages.length };
}

export function localId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function toMessages(raw: any[]): ChatMessage[] {
  return raw.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date(m.createdAt).toISOString(),
    saved: !!m.saved,
    ...(m.payload ? { data: m.payload as AnswerData } : {}),
  }));
}

export function useConversations(signedIn: boolean) {
  const mode: "account" | "device" = signedIn ? "account" : "device";
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceEnabled, setDeviceEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(DEVICE_RETENTION_DAYS);
  const device = useRef<DeviceState>({ v: 1, enabled: true, conversations: [] });

  const commitDevice = useCallback(() => {
    writeDevice(device.current);
    setList(sortConversations(device.current.conversations.map(summary)));
  }, []);

  const refresh = useCallback(
    async (q = "") => {
      if (mode === "device") {
        const needle = q.trim().toLowerCase();
        const all = sortConversations(device.current.conversations);
        if (!needle) {
          setList(all.map(summary));
          return;
        }
        setList(
          all
            .map((c) => {
              const hit = c.messages.find((m) => m.content.toLowerCase().includes(needle));
              if (!c.title.toLowerCase().includes(needle) && !hit) return null;
              const s = summary(c);
              if (hit) {
                const i = hit.content.toLowerCase().indexOf(needle);
                s.match = `${i > 40 ? "…" : ""}${hit.content.slice(Math.max(0, i - 40), i + 120).replace(/\s+/g, " ")}…`;
              }
              return s;
            })
            .filter((s): s is ConversationSummary => !!s)
        );
        return;
      }
      setLoading(true);
      try {
        const res = await apiFetch<{ conversations: ConversationSummary[]; retentionDays?: number }>(
          `/api/corpus-chat/conversations${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`
        );
        setList(res.conversations.map((c) => ({ ...c, createdAt: String(c.createdAt), updatedAt: String(c.updatedAt) })));
        if (res.retentionDays) setRetentionDays(res.retentionDays);
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    },
    [mode]
  );

  useEffect(() => {
    if (mode === "device") {
      device.current = readDevice();
      setDeviceEnabled(device.current.enabled);
      setRetentionDays(DEVICE_RETENTION_DAYS);
    }
    void refresh();
  }, [mode, refresh]);

  const load = useCallback(
    async (id: string): Promise<Conversation | null> => {
      if (mode === "device") return device.current.conversations.find((c) => c.id === id) ?? null;
      try {
        const res = await apiFetch<{ conversation: any }>(`/api/corpus-chat/conversations/${id}`);
        const c = res.conversation;
        return { ...c, createdAt: String(c.createdAt), updatedAt: String(c.updatedAt), messageCount: c.messages.length, messages: toMessages(c.messages) };
      } catch {
        return null;
      }
    },
    [mode]
  );

  /** Saves a question and its answer, creating the conversation if needed.
   * Returns the conversation id and the stored message ids. */
  const saveExchange = useCallback(
    async (
      conversationId: string | null,
      question: ChatMessage,
      answer: ChatMessage
    ): Promise<{ conversationId: string; questionId: string; answerId: string } | null> => {
      const now = new Date().toISOString();
      if (mode === "device") {
        let c = conversationId ? device.current.conversations.find((x) => x.id === conversationId) : undefined;
        if (!c) {
          c = { id: conversationId ?? localId(), title: titleFrom(question.content), pinned: false, createdAt: now, updatedAt: now, messageCount: 0, messages: [] };
          device.current.conversations.push(c);
        }
        c.messages.push(question, answer);
        c.updatedAt = now;
        commitDevice();
        return { conversationId: c.id, questionId: question.id, answerId: answer.id };
      }
      try {
        let id = conversationId;
        if (!id) {
          const created = await apiFetch<{ conversation: ConversationSummary }>("/api/corpus-chat/conversations", {
            method: "POST",
            body: JSON.stringify({ title: question.content }),
          });
          id = created.conversation.id;
        }
        const res = await apiFetch<{ ids: string[] }>(`/api/corpus-chat/conversations/${id}/messages`, {
          method: "POST",
          body: JSON.stringify({
            messages: [
              { role: "user", content: question.content },
              { role: "assistant", content: answer.content, payload: answer.data },
            ],
          }),
        });
        void refresh();
        return { conversationId: id, questionId: res.ids[0], answerId: res.ids[1] };
      } catch {
        return null;
      }
    },
    [mode, commitDevice, refresh]
  );

  const updateAnswer = useCallback(
    async (conversationId: string, messageId: string, content: string, data: AnswerData) => {
      if (mode === "device") {
        const c = device.current.conversations.find((x) => x.id === conversationId);
        const m = c?.messages.find((x) => x.id === messageId);
        if (c && m) {
          m.content = content;
          m.data = data;
          c.updatedAt = new Date().toISOString();
          commitDevice();
        }
        return;
      }
      await apiFetch(`/api/corpus-chat/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ content, payload: data }) }).catch(() => {});
    },
    [mode, commitDevice]
  );

  const setSaved = useCallback(
    async (conversationId: string, messageId: string, saved: boolean) => {
      if (mode === "device") {
        const m = device.current.conversations.find((x) => x.id === conversationId)?.messages.find((x) => x.id === messageId);
        if (m) {
          m.saved = saved;
          commitDevice();
        }
        return true;
      }
      try {
        await apiFetch(`/api/corpus-chat/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ saved }) });
        return true;
      } catch {
        return false;
      }
    },
    [mode, commitDevice]
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      const clean = title.replace(/\s+/g, " ").trim().slice(0, 120);
      if (!clean) return;
      if (mode === "device") {
        const c = device.current.conversations.find((x) => x.id === id);
        if (c) {
          c.title = clean;
          commitDevice();
        }
        return;
      }
      await apiFetch(`/api/corpus-chat/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title: clean }) });
      setList((l) => l.map((c) => (c.id === id ? { ...c, title: clean } : c)));
    },
    [mode, commitDevice]
  );

  const setPinned = useCallback(
    async (id: string, pinned: boolean) => {
      if (mode === "device") {
        const c = device.current.conversations.find((x) => x.id === id);
        if (c) {
          c.pinned = pinned;
          commitDevice();
        }
        return;
      }
      await apiFetch(`/api/corpus-chat/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ pinned }) });
      setList((l) => sortConversations(l.map((c) => (c.id === id ? { ...c, pinned } : c))));
    },
    [mode, commitDevice]
  );

  const remove = useCallback(
    async (id: string) => {
      if (mode === "device") {
        device.current.conversations = device.current.conversations.filter((c) => c.id !== id);
        commitDevice();
        return;
      }
      await apiFetch(`/api/corpus-chat/conversations/${id}`, { method: "DELETE" });
      setList((l) => l.filter((c) => c.id !== id));
    },
    [mode, commitDevice]
  );

  const savedResponses = useCallback(async (): Promise<SavedResponse[]> => {
    if (mode === "device") {
      return device.current.conversations
        .flatMap((c) =>
          c.messages
            .filter((m) => m.saved && m.role === "assistant")
            .map((m) => ({ id: m.id, conversationId: c.id, conversationTitle: c.title, content: m.content, createdAt: m.createdAt, data: m.data }))
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    try {
      const res = await apiFetch<{ saved: any[] }>("/api/corpus-chat/conversations?saved=1");
      return res.saved.map((s) => ({ ...s, createdAt: String(s.createdAt), data: s.payload ?? undefined }));
    } catch {
      return [];
    }
  }, [mode]);

  /** Device mode only: stop (or resume) keeping history in this browser. */
  const setDeviceHistory = useCallback(
    (enabled: boolean) => {
      device.current = { ...device.current, enabled, conversations: enabled ? device.current.conversations : [] };
      setDeviceEnabled(enabled);
      commitDevice();
    },
    [commitDevice]
  );

  const clearDevice = useCallback(() => {
    device.current = { ...device.current, conversations: [] };
    commitDevice();
  }, [commitDevice]);

  return useMemo(
    () => ({
      mode,
      list,
      loading,
      retentionDays,
      deviceEnabled,
      refresh,
      load,
      saveExchange,
      updateAnswer,
      setSaved,
      rename,
      setPinned,
      remove,
      savedResponses,
      setDeviceHistory,
      clearDevice,
    }),
    [mode, list, loading, retentionDays, deviceEnabled, refresh, load, saveExchange, updateAnswer, setSaved, rename, setPinned, remove, savedResponses, setDeviceHistory, clearDevice]
  );
}

export function titleFrom(question: string): string {
  const q = question.replace(/\s+/g, " ").trim();
  return q.length > 80 ? `${q.slice(0, 77).replace(/\s+\S*$/, "")}…` : q || "New conversation";
}
