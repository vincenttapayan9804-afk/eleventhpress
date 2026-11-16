import { APP_BASE_URL } from "@/lib/site";

/**
 * IndexNow (https://www.indexnow.org) — tells Bing, Yandex, Seznam, Naver
 * and the search features built on them (Copilot, DuckDuckGo, ChatGPT
 * search) the moment a public URL is added or changed, instead of waiting
 * for their next crawl.
 *
 * The key is public by design: search engines confirm ownership by
 * fetching /<key>.txt from the same host (public/2386b45ae0baab7758d37e4a159f8834.txt).
 * Google does not take part in IndexNow; it discovers pages through the
 * sitemap (submitted once in Search Console) and links.
 */
export const INDEXNOW_KEY = "2386b45ae0baab7758d37e4a159f8834";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const BATCH = 10_000; // protocol limit per request

/** Submits absolute URLs, grouped by host. Never throws. */
export async function submitToIndexNow(urls: string[]): Promise<{ submitted: number; failed: number }> {
  if (process.env.INDEXNOW_DISABLED === "1" || process.env.VERCEL_ENV === "preview") return { submitted: 0, failed: 0 };
  const byHost = new Map<string, string[]>();
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:") continue;
      const list = byHost.get(u.host) ?? [];
      list.push(u.toString());
      byHost.set(u.host, list);
    } catch {
      // skip malformed URLs
    }
  }
  let submitted = 0;
  let failed = 0;
  for (const [host, list] of byHost) {
    for (let i = 0; i < list.length; i += BATCH) {
      const urlList = list.slice(i, i + BATCH);
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`, urlList }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok || res.status === 202) submitted += urlList.length;
        else {
          failed += urlList.length;
          console.error(`[indexnow] ${host}: HTTP ${res.status}`);
        }
      } catch (e) {
        failed += urlList.length;
        console.error(`[indexnow] ${host}:`, e instanceof Error ? e.message : e);
      }
    }
  }
  return { submitted, failed };
}

/** Re-announces every URL in the platform sitemap (daily cron). */
export async function submitSitemapToIndexNow(base: string = APP_BASE_URL) {
  const res = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!res.ok) throw new Error(`sitemap HTTP ${res.status}`);
  const xml = await res.text();
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1].trim());
  return { found: urls.length, ...(await submitToIndexNow(urls)) };
}
