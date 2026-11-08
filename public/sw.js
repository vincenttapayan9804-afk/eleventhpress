/*
 * Eleventh Press service worker — offline reading.
 * - Article pages (/article/…) and author profiles are cached when visited
 *   (network first, cache fallback), so they open without a connection.
 * - Built static assets (/_next/static/…) are cache-first (immutable).
 * - Anything else that fails offline shows /offline.
 * - API calls, the dashboard and sign-in are never cached.
 */
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, STATIC].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheablePage = (url) => url.origin === self.location.origin && (url.pathname.startsWith("/article/") || url.pathname.startsWith("/authors/"));

async function limit(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && cacheablePage(url)) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy)).then(() => limit(PAGES, 80));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE_URL)))
    );
  }
});

// "Save for offline" from the page (src/components/article-reader-tools.tsx).
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "cache-page" || typeof data.url !== "string") return;
  const url = new URL(data.url, self.location.origin);
  if (!cacheablePage(url)) return;
  event.waitUntil(fetch(url, { credentials: "same-origin" }).then((res) => res.ok && caches.open(PAGES).then((c) => c.put(url.href, res))).catch(() => {}));
});
