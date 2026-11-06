"use client";

import { getCsrfToken } from "@/lib/csrf-client";
import { CSRF_HEADER_NAME } from "@/lib/csrf";
import type { AnswerData, ChatMessage } from "./types";

export interface ExportItem {
  question: string;
  answer: string;
  citations: { n: number; articleId: string; chunkId?: string; kind: string }[];
  evidenceStatus?: string;
  warnings?: string[];
  answeredAt?: string;
}

export function exportItem(question: string, answer: ChatMessage): ExportItem {
  const d = answer.data;
  return {
    question,
    answer: answer.content,
    citations: (d?.citations ?? []).map((c) => ({ n: c.n, articleId: c.articleId, chunkId: c.chunkId, kind: c.kind })),
    evidenceStatus: d?.evidence?.status,
    warnings: d?.evidence?.warnings,
    answeredAt: d?.answeredAt,
  };
}

/** Question/answer pairs of a conversation, in order. */
export function conversationItems(messages: ChatMessage[]): ExportItem[] {
  const out: ExportItem[] = [];
  messages.forEach((m, i) => {
    if (m.role !== "assistant") return;
    const q = [...messages.slice(0, i)].reverse().find((x) => x.role === "user");
    if (q) out.push(exportItem(q.content, m));
  });
  return out;
}

/** Downloads a report from /api/corpus-chat/export. */
export async function downloadReport(
  format: "pdf" | "docx" | "md",
  scope: "response" | "conversation",
  title: string,
  items: ExportItem[]
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  const res = await fetch("/api/corpus-chat/export", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ format, scope, title, items }),
  });
  if (!res.ok) {
    let msg = "The report couldn't be generated.";
    try {
      msg = (await res.json()).error || msg;
    } catch {
      // keep default
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `research-report.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** The answer as plain text with its references, for "Copy". */
export function answerAsText(answer: string, data?: AnswerData): string {
  const text = answer
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .trim();
  const refs = referencesText(data);
  return refs ? `${text}\n\nReferences\n${refs}` : text;
}

/** Numbered evidence and APA references, for "Copy citations". */
export function citationsText(data?: AnswerData): string {
  if (!data?.citations.length) return "";
  const evidence = data.citations
    .map((c) => {
      const s = data.sources.find((x) => x.id === c.articleId);
      const excerpt = c.text.replace(/\s+/g, " ").trim();
      return `[${c.n}] ${s?.title ?? "Article"}. ${c.kind === "record" ? "Article record" : "Passage"}: “${excerpt.length > 300 ? `${excerpt.slice(0, 300)}…` : excerpt}” ${c.url}`;
    })
    .join("\n");
  return `Evidence\n${evidence}\n\nReferences\n${referencesText(data)}`;
}

function referencesText(data?: AnswerData): string {
  return (data?.sources ?? [])
    .map((s) => s.reference)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
