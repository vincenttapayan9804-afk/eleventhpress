/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken } from "@/lib/csrf";

describe("csrf", () => {
  test("generateCsrfToken produces a 64-char hex string", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generateCsrfToken is not deterministic", () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });

  test("constants are stable, non-empty names", () => {
    expect(CSRF_COOKIE_NAME.length).toBeGreaterThan(0);
    expect(CSRF_HEADER_NAME.length).toBeGreaterThan(0);
  });
});

describe("proxy CSRF logic (mirrors src/proxy.ts's inline check)", () => {
  const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const CSRF_EXEMPT_PREFIXES = [
    "/api/webhooks/",
    "/api/billing/webhook/",
    "/api/cron/",
    "/api/storage/upload-local/",
    "/api/auth/login",
    "/api/auth/register",
  ];

  function shouldBlock(method: string, pathname: string, cookieToken: string | undefined, headerToken: string | null): boolean {
    const isMutating = MUTATING_METHODS.has(method);
    const isExempt = CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isMutating || isExempt) return false;
    return !cookieToken || !headerToken || cookieToken !== headerToken;
  }

  test("GET is never blocked regardless of tokens", () => {
    expect(shouldBlock("GET", "/api/articles", undefined, null)).toBe(false);
  });

  test("matching cookie/header pair on a mutating request passes", () => {
    expect(shouldBlock("POST", "/api/reviews/submit", "abc123", "abc123")).toBe(false);
  });

  test("missing header on a mutating request is blocked", () => {
    expect(shouldBlock("POST", "/api/reviews/submit", "abc123", null)).toBe(true);
  });

  test("mismatched cookie/header pair is blocked", () => {
    expect(shouldBlock("POST", "/api/reviews/submit", "abc123", "different")).toBe(true);
  });

  test("missing cookie on a mutating request is blocked", () => {
    expect(shouldBlock("PATCH", "/api/auth/me", undefined, "abc123")).toBe(true);
  });

  test("exempt prefixes pass with no CSRF header at all", () => {
    expect(shouldBlock("POST", "/api/webhooks/ithenticate", undefined, null)).toBe(false);
    expect(shouldBlock("POST", "/api/billing/webhook/stripe", undefined, null)).toBe(false);
    expect(shouldBlock("POST", "/api/cron/galley-sweep", undefined, null)).toBe(false);
    expect(shouldBlock("PUT", "/api/storage/upload-local/tok123", undefined, null)).toBe(false);
    expect(shouldBlock("POST", "/api/auth/login", undefined, null)).toBe(false);
    expect(shouldBlock("POST", "/api/auth/register", undefined, null)).toBe(false);
  });

  test("non-exempt route with mismatched tokens is still blocked", () => {
    expect(shouldBlock("DELETE", "/api/articles/abc123", "a", "b")).toBe(true);
  });
});
