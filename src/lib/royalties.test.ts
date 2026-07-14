/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test";
import { computeAuthorPayout } from "@/lib/royalties";

describe("computeAuthorPayout", () => {
  test("computes the author's share of gross revenue at the default 70%", () => {
    expect(computeAuthorPayout(1000, 70)).toBe(700);
  });

  test("rounds to the nearest cent", () => {
    expect(computeAuthorPayout(100, 33.33)).toBe(33.33);
    expect(computeAuthorPayout(10, 33.333)).toBe(3.33);
  });

  test("zero gross revenue produces zero payout regardless of share", () => {
    expect(computeAuthorPayout(0, 70)).toBe(0);
  });

  test("100% share pays out the full gross revenue", () => {
    expect(computeAuthorPayout(500, 100)).toBe(500);
  });

  test("0% share pays out nothing", () => {
    expect(computeAuthorPayout(500, 0)).toBe(0);
  });
});
