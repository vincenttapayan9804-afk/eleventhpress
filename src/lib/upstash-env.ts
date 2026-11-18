/**
 * Upstash Redis connection settings. Accepts the names Upstash's own
 * console gives (UPSTASH_REDIS_REST_*) and the names the Vercel
 * Marketplace Upstash integration sets (KV_REST_API_*), so either setup
 * route works. Import-free so the proxy bundle can use it.
 */
export function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}
