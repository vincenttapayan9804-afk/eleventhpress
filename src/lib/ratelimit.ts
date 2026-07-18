import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Real per-IP rate limiting on auth endpoints, backed by Upstash's
 * serverless Redis (free tier) — the OSS-client + LiveMode-gated-free-
 * external-service pattern this repo already uses for Zenodo/iThenticate/
 * Meilisearch. Applied at the route level (not centralized in
 * middleware.ts) since limits are per-route (login vs. register), matching
 * this repo's "explicit at the point of use" style — e.g. every route's
 * own inline getSessionFromHeaders() call rather than middleware owning
 * route-specific business knowledge.
 */
export function ratelimitLiveMode(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// One Ratelimit instance per (max, window) pair actually used, cached so
// repeated calls with the same limits reuse the same sliding-window state.
const limiters = new Map<string, Ratelimit>();
function getLimiter(maxRequests: number, windowSeconds: number): Ratelimit {
  const key = `${maxRequests}:${windowSeconds}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      prefix: "epip-ratelimit",
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export interface RateLimitResult {
  ok: boolean;
  mode: "live" | "simulation";
  message: string;
}

/**
 * `key` should already include the route/purpose (e.g. `login:1.2.3.4`) so
 * different endpoints don't share a bucket for the same IP. When Upstash
 * isn't configured, fails open (never blocks) but tags the result so this
 * is visible rather than silently indistinguishable from "enforced and
 * within limits" — the honesty convention this repo's LiveMode pattern
 * exists for.
 */
export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<RateLimitResult> {
  if (!ratelimitLiveMode()) {
    console.warn(`[ratelimit] simulation mode — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enforce real limits for key "${key}"`);
    return {
      ok: true,
      mode: "simulation",
      message: "Rate limiting not configured — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable.",
    };
  }
  const { success } = await getLimiter(maxRequests, windowSeconds).limit(key);
  return {
    ok: success,
    mode: "live",
    message: success ? "" : "Too many attempts — try again shortly.",
  };
}
