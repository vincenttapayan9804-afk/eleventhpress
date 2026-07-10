"use client";
import { useApp } from "./store";

/** Thin fetch wrapper that auto-attaches the bearer token. */
export async function apiFetch<T = any>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = useApp.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...init, headers });
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
