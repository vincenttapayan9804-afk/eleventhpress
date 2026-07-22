# Content Security Policy

Current policy (`next.config.ts`):

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

## What changed and why

`script-src` no longer includes `'unsafe-eval'`. This was verified — not
assumed — safe to remove:

1. Confirmed via `grep` (not guesswork) that neither `@mdxeditor/editor`
   nor `pdfjs-dist`, the two dependencies most likely to need `eval`, are
   actually imported by any client component today. `pdfjs-dist`'s only
   use in this codebase is server-side PDF text extraction
   (`src/lib/galley.ts`, via `src/lib/pdfjs-node-polyfill.ts`) — it never
   runs in a browser. `@mdxeditor/editor` is an installed dependency that
   isn't wired into the UI at all yet (tracked separately — see the
   pending "ATAG real authoring tool" work).
2. Built a real production bundle (`next build`, then ran
   `.next/standalone/server.js` directly — not `next dev`, and not
   `next start`, which warns it's incompatible with `output: standalone`)
   and drove it with Playwright, watching the browser console for CSP
   violation errors, across: the home page, the Browse page, the
   react-three-fiber "3D Discipline Towers" panel (the app's one
   genuinely non-trivial client-side rendering surface), the
   authenticated Dashboard, and the manuscript submission form. Zero
   violations with `'unsafe-eval'` removed.

## What was attempted and reverted: nonce-based `script-src`

A per-request nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'`,
generated in `src/proxy.ts`) was implemented to also drop
`'unsafe-inline'` — this is the more consequential removal, since
`'unsafe-inline'` is what actually allows a reflected/stored-XSS payload
to inject and run its own `<script>` tag.

It was reverted after the same production-build Playwright test above
caught real, site-breaking `Content-Security-Policy` violations on **every
page** — Next.js's own framework scripts got refused. Root cause,
confirmed against Next.js's own bundled docs
(`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`):

> When you use nonces in your CSP, **all pages must be dynamically
> rendered**... Static pages are generated at build time, when no request
> or response headers exist — so no nonce can be injected.

This app's home page and other marketing/content pages are statically
generated (`next build`'s own route table marks them `○ Static`). A nonce
baked into that HTML at build time can never match the fresh nonce
generated for the real, later request — so the browser correctly refuses
every script Next attached that stale nonce to. Turbopack's *dev* server
misleadingly worked fine (dev always renders dynamically), which is
exactly why this was verified against a real production build rather than
trusted from dev-server testing alone.

Adopting a nonce-based CSP for real would require opting every page into
dynamic rendering — Next's own docs list the real cost of that
explicitly: no static optimization, no ISR, no CDN caching, higher
hosting cost, slower initial loads. That's a genuine architecture and
cost tradeoff for this app's marketing/content pages, not something to
fold silently into a security-hardening pass. If `'unsafe-inline'` on
`script-src` needs to go, the two realistic paths are:

- Force dynamic rendering everywhere and accept the performance/cost
  tradeoff above, or
- Next's experimental Subresource Integrity (SRI) support
  (`experimental.sri` in `next.config.ts`), which keeps static
  generation but is explicitly marked experimental and untested here —
  would need its own dedicated verification pass before shipping.

Neither is attempted in this pass.

## `middleware.ts` → `src/proxy.ts`

Along the way, this also fixed an unrelated but real issue: Next.js 16
deprecated the `middleware.ts` file convention in favor of `proxy.ts`
(same runtime API — `export function proxy` instead of `export function
middleware`). It must live at `src/proxy.ts` in this project specifically
(co-located with `src/app`), not at the repo root — confirmed empirically:
a root-level file silently never ran (no compile log line, no effect on
any response) until moved.
