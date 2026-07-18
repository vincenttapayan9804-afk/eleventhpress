"use client";
import { CSRF_COOKIE_NAME } from "./csrf";

/** Reads the CSRF cookie middleware.ts sets on every visit — used by
 * api-client.ts to echo it back as a header on mutating requests. */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
