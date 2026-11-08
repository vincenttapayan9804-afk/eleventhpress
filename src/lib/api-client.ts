"use client";
import { getCsrfToken } from "./csrf-client";
import { CSRF_HEADER_NAME } from "./csrf";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Fired on window when an API call finds the session has ended. */
export const SESSION_ENDED_EVENT = "ep:session-ended";

/**
 * On a whitelabel tenant platform reached through the official host, tags
 * GET API requests with `__ws=<tenant slug>` (set by the root layout on
 * <body data-ws>). The CDN keys its cache on the URL, so this keeps a
 * tenant's responses and the official site's cached responses apart. The
 * server ignores the value for anything except cache decisions.
 */
export function withWorkspaceTag(path: string): string {
  if (typeof document === "undefined" || !path.startsWith("/api/")) return path;
  const ws = document.body?.dataset.ws;
  if (!ws) return path;
  return `${path}${path.includes("?") ? "&" : "?"}__ws=${encodeURIComponent(ws)}`;
}

/**
 * Thin fetch wrapper. Auth is carried by the httpOnly session cookie, which
 * the browser attaches automatically on same-origin requests. Mutating
 * requests also echo back the (non-httpOnly) CSRF cookie as a header —
 * middleware.ts's double-submit check requires the pair to match.
 */
export async function apiFetch<T = any>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  const method = (init?.method || "GET").toUpperCase();
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;
  }

  const res = await fetch(method === "GET" ? withWorkspaceTag(path) : path, { ...init, headers, credentials: "same-origin" });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let body: any = null;
    try {
      body = await res.json();
      msg = body.error || msg;
    } catch {
      // ignore parse errors
    }
    // A 401 outside the sign-in endpoints means the session cookie is gone
    // or was replaced (e.g. signed out in another tab) while this page still
    // shows someone signed in — SessionSync (session-sync.tsx) resets the UI.
    if (res.status === 401 && typeof window !== "undefined" && !/^\/api\/auth\/(login|2fa|register|forgot|reset)/.test(path)) {
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
    }
    const err = new Error(msg) as Error & { status: number; body: any };
    err.status = res.status;
    // Some error responses (e.g. the tenant purge endpoint's 409) carry
    // structured detail beyond a plain message — attach the parsed body so
    // callers that need it can read it (`(e as any).body`), without
    // changing behavior for the many callers that only read e.message.
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
