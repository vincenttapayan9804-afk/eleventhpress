/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { hashPassword, passwordFingerprint, signPasswordResetToken, verifyPasswordResetToken, verifyToken, signPendingTwoFactorToken } from "@/lib/auth";

describe("password reset tokens", () => {
  const hash = hashPassword("old-password-123");

  test("round-trips the user and the password fingerprint", () => {
    const token = signPasswordResetToken("user_1", hash);
    expect(verifyPasswordResetToken(token)).toEqual({ userId: "user_1", fp: passwordFingerprint(hash) });
  });

  test("the fingerprint changes once the password changes, voiding older links", () => {
    expect(passwordFingerprint(hashPassword("new-password-456"))).not.toBe(passwordFingerprint(hash));
  });

  test("is never accepted as a session or a pending-2FA token, and vice versa", () => {
    const token = signPasswordResetToken("user_1", hash);
    expect(verifyToken(token)).toBeNull();
    expect(verifyPasswordResetToken(signPendingTwoFactorToken("user_1"))).toBeNull();
  });

  test("rejects garbage", () => {
    expect(verifyPasswordResetToken("not-a-token")).toBeNull();
  });
});
