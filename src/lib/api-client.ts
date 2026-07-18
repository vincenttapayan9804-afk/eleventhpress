"use client";

/**
 * Thin fetch wrapper. Auth is carried by the httpOnly session cookie, which
 * the browser attaches automatically on same-origin requests — nothing
 * client-JS-readable to add here.
 */
export async function apiFetch<T = any>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
