/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { lockoutMinutesFor, isLocked, minutesRemaining, LOCK_THRESHOLD } from "@/lib/account-lockout";

describe("lockoutMinutesFor", () => {
  test("returns null below the threshold", () => {
    for (let i = 0; i < LOCK_THRESHOLD; i++) {
      expect(lockoutMinutesFor(i)).toBeNull();
    }
  });

  test("returns null between multiples of the threshold", () => {
    expect(lockoutMinutesFor(LOCK_THRESHOLD + 1)).toBeNull();
    expect(lockoutMinutesFor(LOCK_THRESHOLD + 2)).toBeNull();
  });

  test("locks at the first multiple of the threshold", () => {
    expect(lockoutMinutesFor(LOCK_THRESHOLD)).toBe(15);
  });

  test("escalates on subsequent multiples", () => {
    expect(lockoutMinutesFor(LOCK_THRESHOLD * 2)).toBe(30);
    expect(lockoutMinutesFor(LOCK_THRESHOLD * 3)).toBe(45);
  });

  test("caps at 60 minutes", () => {
    expect(lockoutMinutesFor(LOCK_THRESHOLD * 10)).toBe(60);
  });
});

describe("isLocked", () => {
  test("false when lockedUntil is null", () => {
    expect(isLocked(null)).toBe(false);
  });

  test("false when lockedUntil is in the past", () => {
    expect(isLocked(new Date(Date.now() - 1000))).toBe(false);
  });

  test("true when lockedUntil is in the future", () => {
    expect(isLocked(new Date(Date.now() + 60_000))).toBe(true);
  });
});

describe("minutesRemaining", () => {
  test("rounds up to at least 1 minute", () => {
    expect(minutesRemaining(new Date(Date.now() + 1000))).toBe(1);
  });

  test("rounds up partial minutes", () => {
    expect(minutesRemaining(new Date(Date.now() + 90_000))).toBe(2);
  });
});
