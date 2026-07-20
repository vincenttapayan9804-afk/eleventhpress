import { Redis } from "@upstash/redis";

/**
 * Real-time reader presence — "N people reading this now" on the article
 * page. Uses the same Upstash serverless Redis this codebase already
 * configures for rate limiting (src/lib/ratelimit.ts), not the
 * WebSocket-based ws-service mini-service (mini-services/ws-service) —
 * that service needs an always-on host outside Vercel's serverless model
 * (same category as the Pandoc/WeasyPrint worker per docs/deployment.md)
 * and isn't deployed anywhere today, so building "live presence" on top of
 * it would mean building on infrastructure that doesn't actually exist in
 * production. A short-TTL Redis key per (article, reader) that a client
 * heartbeat refreshes is genuinely serverless-compatible and reuses an
 * integration already proven live in this codebase.
 *
 * Same LiveMode-gated-free-external-service pattern as ratelimit.ts: fails
 * open (reports 0/simulation) rather than blocking anything when Upstash
 * isn't configured.
 */
export function presenceLiveMode(): boolean {
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

// A closed tab never sends an explicit "leave" signal, so presence expires
// naturally via TTL instead — a bit longer than the client's heartbeat
// interval (see article-view.tsx's PRESENCE_HEARTBEAT_MS) so a single
// missed beat doesn't flicker a reader in and out of the count.
const PRESENCE_TTL_SECONDS = 45;

/** Marks `sessionId` as actively reading `articleId` right now. Refreshing
 * the same key (same reader, same tab) never creates a second entry. */
export async function heartbeatPresence(articleId: string, sessionId: string): Promise<void> {
  if (!presenceLiveMode()) return;
  await getRedis().set(`epip-presence:${articleId}:${sessionId}`, 1, { ex: PRESENCE_TTL_SECONDS });
}

export interface PresenceResult {
  count: number;
  mode: "live" | "simulation";
}

/** Counts distinct active readers on `articleId` right now. */
export async function getPresenceCount(articleId: string): Promise<PresenceResult> {
  if (!presenceLiveMode()) {
    return { count: 0, mode: "simulation" };
  }
  const keys = await getRedis().keys(`epip-presence:${articleId}:*`);
  return { count: keys.length, mode: "live" };
}
