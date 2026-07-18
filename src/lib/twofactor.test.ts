/// <reference types="bun-types" />
/**
 * TOTP enrollment/verification (src/lib/twofactor.ts) — real otplib/bcrypt
 * calls, no mocking needed since both are deterministic given a secret/
 * timestamp and don't touch the network or DB.
 */
import { describe, test, expect } from "bun:test";
import { generate as generateOtp } from "otplib";
import {
  generateTwoFactorSecret,
  generateTwoFactorQrCode,
  verifyTwoFactorToken,
  generateBackupCodes,
  consumeBackupCode,
} from "@/lib/twofactor";

describe("generateTwoFactorSecret", () => {
  test("returns a non-empty base32 secret, different each call", () => {
    const a = generateTwoFactorSecret();
    const b = generateTwoFactorSecret();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("generateTwoFactorQrCode", () => {
  test("returns a data:image PNG URL embedding the secret's otpauth URI", async () => {
    const secret = generateTwoFactorSecret();
    const qr = await generateTwoFactorQrCode("author@example.com", secret);
    expect(qr.startsWith("data:image/png;base64,")).toBe(true);
  });
});

describe("verifyTwoFactorToken", () => {
  test("accepts the current real code for the secret", async () => {
    const secret = generateTwoFactorSecret();
    const validToken = await generateOtp({ secret });
    expect(await verifyTwoFactorToken(validToken, secret)).toBe(true);
  });

  test("rejects a wrong code", async () => {
    const secret = generateTwoFactorSecret();
    expect(await verifyTwoFactorToken("000000", secret)).toBe(false);
  });

  test("rejects a code generated for a different secret", async () => {
    const secretA = generateTwoFactorSecret();
    const secretB = generateTwoFactorSecret();
    const tokenForB = await generateOtp({ secret: secretB });
    expect(await verifyTwoFactorToken(tokenForB, secretA)).toBe(false);
  });

  test("never throws on garbage input", async () => {
    const secret = generateTwoFactorSecret();
    await expect(verifyTwoFactorToken("not-a-code", secret)).resolves.toBe(false);
  });
});

describe("generateBackupCodes", () => {
  test("returns 10 unique plaintext codes and a matching comma-separated hash list", () => {
    const { plaintext, hashed } = generateBackupCodes();
    expect(plaintext.length).toBe(10);
    expect(new Set(plaintext).size).toBe(10);
    expect(hashed.split(",").length).toBe(10);
    for (const code of plaintext) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    }
  });
});

describe("consumeBackupCode", () => {
  test("returns the remaining hash list (one shorter) on a correct code, case-insensitively", () => {
    const { plaintext, hashed } = generateBackupCodes();
    const target = plaintext[3];
    const remaining = consumeBackupCode(target.toLowerCase(), hashed);
    expect(remaining).not.toBeNull();
    expect(remaining!.split(",").length).toBe(9);
  });

  test("returns null for a code that doesn't match any hash", () => {
    const { hashed } = generateBackupCodes();
    expect(consumeBackupCode("ZZZZZ-ZZZZZ", hashed)).toBeNull();
  });

  test("returns null when there is no stored backup-code list", () => {
    expect(consumeBackupCode("ZZZZZ-ZZZZZ", null)).toBeNull();
  });

  test("a consumed code can't be reused against the returned remaining list", () => {
    const { plaintext, hashed } = generateBackupCodes();
    const target = plaintext[0];
    const remaining = consumeBackupCode(target, hashed)!;
    expect(consumeBackupCode(target, remaining)).toBeNull();
  });
});
