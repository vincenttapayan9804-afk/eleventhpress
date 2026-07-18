/// <reference types="bun-types" />
/**
 * checkRateLimit() (src/lib/ratelimit.ts) — the honesty guarantee (never
 * silently no-ops as "enforced" when Upstash isn't configured) and the
 * live-mode pass-through to the mocked Upstash client.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

let limitResult = { success: true };
let limitCalls: string[] = [];

mock.module("@upstash/redis", () => ({
  Redis: class {
    constructor(_opts: any) {}
  },
}));

mock.module("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow(max: number, window: string) {
      return { type: "slidingWindow", max, window };
    }
    constructor(_opts: any) {}
    async limit(key: string) {
      limitCalls.push(key);
      return limitResult;
    }
  },
}));

const { ratelimitLiveMode, checkRateLimit } = await import("@/lib/ratelimit");

const ORIGINAL_URL = process.env.UPSTASH_REDIS_REST_URL;
const ORIGINAL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function reset() {
  limitResult = { success: true };
  limitCalls = [];
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

beforeEach(reset);

describe("ratelimitLiveMode", () => {
  test("false when neither env var is set", () => {
    expect(ratelimitLiveMode()).toBe(false);
  });

  test("false when only one env var is set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    expect(ratelimitLiveMode()).toBe(false);
  });

  test("true when both env vars are set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token123";
    expect(ratelimitLiveMode()).toBe(true);
  });
});

describe("checkRateLimit — simulation mode (not configured)", () => {
  test("always returns ok:true, mode:simulation, and never calls the Upstash client", async () => {
    const result = await checkRateLimit("login:1.2.3.4", 10, 60);
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("simulation");
    expect(result.message).toContain("UPSTASH_REDIS_REST_URL");
    expect(limitCalls.length).toBe(0);
  });
});

describe("checkRateLimit — live mode", () => {
  test("calls through to the Upstash limiter with the given key and returns ok:true on success", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token123";
    limitResult = { success: true };
    const result = await checkRateLimit("login:1.2.3.4", 10, 60);
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("live");
    expect(limitCalls).toContain("login:1.2.3.4");
  });

  test("returns ok:false with a human-readable message when the limiter reports failure", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token123";
    limitResult = { success: false };
    const result = await checkRateLimit("login:5.6.7.8", 10, 60);
    expect(result.ok).toBe(false);
    expect(result.mode).toBe("live");
    expect(result.message.length).toBeGreaterThan(0);
  });
});

// Restore the real env after this file's tests so it doesn't leak into
// other test files run in the same process.
process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_URL;
process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_TOKEN;
