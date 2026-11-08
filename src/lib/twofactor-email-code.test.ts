import { describe, expect, test } from "bun:test";
import { emailCodeMatches, generateEmailCode, hashEmailCode, maskEmail } from "./twofactor-email-code";

describe("emailed two-factor codes", () => {
  test("codes are six digits, zero-padded", () => {
    for (let i = 0; i < 200; i++) expect(generateEmailCode()).toMatch(/^\d{6}$/);
  });

  test("a code matches only for the account it was issued to", () => {
    const hash = hashEmailCode("user-a", "042917");
    expect(emailCodeMatches("user-a", "042917", hash)).toBe(true);
    expect(emailCodeMatches("user-a", "042 917", hash)).toBe(true);
    expect(emailCodeMatches("user-b", "042917", hash)).toBe(false);
    expect(emailCodeMatches("user-a", "042918", hash)).toBe(false);
  });

  test("rejects malformed input and missing hashes", () => {
    const hash = hashEmailCode("u", "123456");
    expect(emailCodeMatches("u", "AB12C-D3E4F", hash)).toBe(false);
    expect(emailCodeMatches("u", "12345", hash)).toBe(false);
    expect(emailCodeMatches("u", "123456", null)).toBe(false);
    expect(emailCodeMatches("u", "123456", "not-hex")).toBe(false);
  });

  test("the stored value is not the code itself", () => {
    expect(hashEmailCode("u", "123456")).not.toContain("123456");
  });

  test("masks the address", () => {
    expect(maskEmail("maria.santos@uni.edu")).toBe("ma••••••••••@uni.edu");
    expect(maskEmail("a@x.org")).toBe("a•••@x.org");
  });
});
