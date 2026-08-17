"use client";
import { getCsrfToken } from "./csrf-client";
import { CSRF_HEADER_NAME } from "./csrf";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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

  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let body: any = null;
    try {
      body = await res.json();
      msg = body.error || msg;
    } catch {
      // ignore parse errors
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
