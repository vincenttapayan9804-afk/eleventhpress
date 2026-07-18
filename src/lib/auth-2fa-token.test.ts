/// <reference types="bun-types" />
/**
 * signPendingTwoFactorToken/verifyPendingTwoFactorToken (src/lib/auth.ts)
 * — the narrow, short-lived token issued instead of a real session when
 * login hits a twoFactorEnabled account. Real jsonwebtoken calls, no
 * mocking needed.
 */
import { describe, test, expect } from "bun:test";
import jwt from "jsonwebtoken";
import { signPendingTwoFactorToken, verifyPendingTwoFactorToken, verifyToken } from "@/lib/auth";

describe("signPendingTwoFactorToken / verifyPendingTwoFactorToken", () => {
  test("round-trips the userId", () => {
    const token = signPendingTwoFactorToken("user_123");
    expect(verifyPendingTwoFactorToken(token)).toEqual({ userId: "user_123" });
  });

  test("rejects garbage input", () => {
    expect(verifyPendingTwoFactorToken("not-a-jwt")).toBeNull();
  });

  test("is not accepted by verifyToken() — a leaked pending token can't be used as a real session", () => {
    const token = signPendingTwoFactorToken("user_123");
    expect(verifyToken(token)).toBeNull();
  });

  test("a real session token is not accepted by verifyPendingTwoFactorToken()", () => {
    // A token missing kind: "2fa_pending" (e.g. a real session JWT) must
    // not be treated as a valid pending-2FA token.
    const foreignToken = jwt.sign(
      { userId: "user_123", email: "a@b.com", role: "READER", fullName: "A B" },
      process.env.SESSION_SECRET || "epip-dev-only-insecure-secret-do-not-use-in-prod"
    );
    expect(verifyPendingTwoFactorToken(foreignToken)).toBeNull();
  });
});
