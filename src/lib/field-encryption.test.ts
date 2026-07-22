/// <reference types="bun-types" />
/**
 * Field-level encryption for User's OAuth tokens (src/lib/field-encryption.ts)
 * — round-trip correctness, read-compatibility with legacy plaintext rows,
 * tamper detection, and the User-object helpers the Prisma extension in
 * src/lib/db.ts is built on.
 */
import { describe, test, expect } from "bun:test";
import {
  encryptField,
  decryptField,
  encryptUserFields,
  decryptUserFields,
  ENCRYPTED_USER_FIELDS,
} from "@/lib/field-encryption";

describe("encryptField / decryptField", () => {
  test("round-trips a plaintext value", () => {
    // nosemgrep: generic.secrets.security.detected-google-oauth-access-token.detected-google-oauth-access-token -- fake, OAuth-token-shaped test fixture (exercises round-tripping a realistic value), not a real credential; gitleaks (a real secret scanner) confirms this repo is clean.
    const original = "ya29.a0AfH6SMC_real_looking_access_token";
    const encrypted = encryptField(original);
    expect(decryptField(encrypted)).toBe(original);
  });

  test("encrypted output carries the version marker and is not the plaintext", () => {
    const encrypted = encryptField("secret-token");
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(encrypted).not.toContain("secret-token");
  });

  test("two encryptions of the same plaintext produce different ciphertext (random IV)", () => {
    const a = encryptField("same-token");
    const b = encryptField("same-token");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe("same-token");
    expect(decryptField(b)).toBe("same-token");
  });

  test("a value without the marker (legacy plaintext row) passes through unchanged", () => {
    expect(decryptField("sim_access_1234567890")).toBe("sim_access_1234567890");
    expect(decryptField("plain-legacy-token")).toBe("plain-legacy-token");
  });

  test("tampered ciphertext fails GCM auth-tag verification rather than silently returning garbage", () => {
    const encrypted = encryptField("original-token");
    const tampered = encrypted.slice(0, -4) + "abcd";
    expect(() => decryptField(tampered)).toThrow();
  });

  test("empty string round-trips correctly", () => {
    const encrypted = encryptField("");
    expect(decryptField(encrypted)).toBe("");
  });
});

describe("encryptUserFields", () => {
  test("encrypts only the known token fields, leaving everything else untouched", () => {
    const data = {
      email: "author@example.com",
      orcidAccessToken: "orcid-access",
      orcidRefreshToken: "orcid-refresh",
      bloggerAccessToken: "blogger-access",
      bloggerRefreshToken: "blogger-refresh",
      fullName: "Dr. Jane Doe",
    };
    encryptUserFields(data);
    expect(data.email).toBe("author@example.com");
    expect(data.fullName).toBe("Dr. Jane Doe");
    for (const field of ENCRYPTED_USER_FIELDS) {
      expect((data as any)[field].startsWith("enc:v1:")).toBe(true);
    }
  });

  test("leaves absent fields alone (a write that only sets some of the four)", () => {
    const data: any = { bloggerAccessToken: "only-this-one" };
    encryptUserFields(data);
    expect(data.bloggerAccessToken.startsWith("enc:v1:")).toBe(true);
    expect(data.orcidAccessToken).toBeUndefined();
  });

  test("is a no-op on null/undefined data", () => {
    expect(encryptUserFields(null)).toBeNull();
    expect(encryptUserFields(undefined)).toBeUndefined();
  });
});

describe("decryptUserFields", () => {
  test("decrypts only the known token fields present on a query result", () => {
    const result: any = {
      id: "user-1",
      orcidAccessToken: encryptField("real-orcid-token"),
      bloggerAccessToken: encryptField("real-blogger-token"),
      orcidRefreshToken: null,
    };
    decryptUserFields(result);
    expect(result.orcidAccessToken).toBe("real-orcid-token");
    expect(result.bloggerAccessToken).toBe("real-blogger-token");
    expect(result.orcidRefreshToken).toBeNull(); // untouched — not a string
  });

  test("is a no-op when none of the four fields were selected (e.g. an admin listing query)", () => {
    const result = { id: "user-1", email: "a@b.com", role: "READER" };
    const decrypted = decryptUserFields({ ...result });
    expect(decrypted).toEqual(result);
  });

  test("round-trips through encryptUserFields then decryptUserFields", () => {
    const data: any = {
      orcidAccessToken: "tok-1",
      orcidRefreshToken: "tok-2",
      bloggerAccessToken: "tok-3",
      bloggerRefreshToken: "tok-4",
    };
    encryptUserFields(data);
    decryptUserFields(data);
    expect(data).toEqual({
      orcidAccessToken: "tok-1",
      orcidRefreshToken: "tok-2",
      bloggerAccessToken: "tok-3",
      bloggerRefreshToken: "tok-4",
    });
  });

  test("is a no-op on null/undefined", () => {
    expect(decryptUserFields(null)).toBeNull();
    expect(decryptUserFields(undefined)).toBeUndefined();
  });
});
