/**
 * Fast revoked-session lookups for the proxy (src/proxy.ts), backed by
 * Upstash Redis when it's configured. Deliberately free of database
 * imports so the proxy bundle stays small. Without Redis, revocation is
 * still enforced by GET /api/auth/me (src/lib/user-sessions.ts).
 */
const PREFIX = "epip-revoked:";
const TTL_SECONDS = 8 * 24 * 3600;

function configured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function client() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

export async function markRevoked(ids: string[]): Promise<void> {
  if (!ids.length || !configured()) return;
  try {
    const r = await client();
    await Promise.all(ids.map((id) => r.set(`${PREFIX}${id}`, 1, { ex: TTL_SECONDS })));
  } catch (e) {
    console.error("[sessions] revoke cache failed:", e);
  }
}

const recent = new Map<string, { revoked: boolean; at: number }>();

/** Whether a session id was signed out (cached for 30 s per instance). Fails open. */
export async function isRevokedFast(sid: string): Promise<boolean> {
  if (!configured()) return false;
  const hit = recent.get(sid);
  if (hit && Date.now() - hit.at < 30_000) return hit.revoked;
  try {
    const revoked = !!(await (await client()).get(`${PREFIX}${sid}`));
    if (recent.size > 5000) recent.clear();
    recent.set(sid, { revoked, at: Date.now() });
    return revoked;
  } catch {
    return false;
  }
}

/** The `sid` claim of a session JWT, read without verifying it (only ever used to deny). */
export function sidOfToken(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.sid === "string" ? json.sid : null;
  } catch {
    return null;
  }
}
