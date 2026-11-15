"use client";

/**
 * Asks /api/corpus-chat with a streamed reply: the server sends each step
 * of its work as it starts (understanding, searching, reading N passages,
 * writing, checking), then the answer. Aborting the signal (Stop) closes
 * the connection, which also cancels the model request on the server.
 */
import { getCsrfToken } from "@/lib/csrf-client";
import { CSRF_HEADER_NAME } from "@/lib/csrf";
import { SESSION_ENDED_EVENT } from "@/lib/api-client";
import type { ApiAnswer, StageState } from "./chat-parts";

export class AskError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function askStream(
  body: Record<string, unknown>,
  opts: { signal?: AbortSignal; onStage?: (s: StageState) => void } = {}
): Promise<ApiAnswer> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/x-ndjson, application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  const res = await fetch("/api/corpus-chat", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      // not JSON
    }
    if (res.status === 401 && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
    throw new AskError(parsed?.error || `Request failed (${res.status})`, res.status, parsed);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("ndjson") || !res.body) return (await res.json()) as ApiAnswer;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ApiAnswer | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg?.type === "stage") opts.onStage?.({ stage: msg.stage, passages: msg.passages, articles: msg.articles, scope: msg.scope });
    else if (msg?.type === "result") {
      const { type: _t, ...rest } = msg;
      result = rest as ApiAnswer;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      handle(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
    if (done) break;
  }
  handle(buffer);
  if (!result) throw new AskError("The answer was interrupted. Please try again.", 503, null);
  return result;
}
