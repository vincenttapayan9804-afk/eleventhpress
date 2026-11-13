import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// A nonce-based script-src (no 'unsafe-inline') was attempted and
// reverted — see src/proxy.ts's comment and docs/csp.md for why: nonces
// require every page to be dynamically rendered, which this app's
// statically-generated marketing/content pages aren't, and there's no
// way to inject a per-request nonce into next.config's static headers()
// output anyway. 'unsafe-eval' IS removed here, verified (via Playwright
// against a real production standalone build, not just `next dev`) to be
// unnecessary — see docs/csp.md.
const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' (distinct from, and much narrower than,
  // 'unsafe-eval') is what @embedpdf's PDFium engine actually needs:
  // its Emscripten-compiled WebAssembly.instantiate() call was being
  // silently rejected without it — CSP treats non-streaming WASM
  // instantiation the same as eval() unless this specific keyword is
  // present. It permits compiling/running WebAssembly modules only;
  // it does not enable arbitrary string-to-JS eval() the way
  // 'unsafe-eval' does, so it doesn't reopen the risk that keyword was
  // deliberately removed for.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  // The inline PDF preview's PDFium/WASM engine (@embedpdf/react-pdf-viewer)
  // runs in a Worker constructed from a same-origin blob: URL — the
  // standard way any WASM-backed library ships its engine off the main
  // thread. Without an explicit worker-src, that falls back to script-src,
  // which doesn't permit blob: workers. This only allows workers built
  // from the page's own already-loaded, already-CSP-vetted script content
  // (a blob: URL can't be handed a remote origin's code) — it doesn't
  // loosen script-src/style-src/connect-src against remote injection.
  "worker-src 'self' blob:",
  // wavesurfer.js (the narration "Listen" waveform player) always fetches
  // the audio itself and hands its internal <audio> element a blob: object
  // URL for playback — not a config choice, that's how its Player class
  // works regardless of backend. Without an explicit media-src, that falls
  // back to default-src 'self', which rejects blob:. Same reasoning as
  // worker-src above: this only permits blob: URLs the page created from
  // its own already-fetched, same-origin audio response, not arbitrary
  // remote media.
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // PDFKit reads its .afm font-metric files from disk at runtime — keep it
  // out of the webpack bundle so those assets are traced and shipped as-is.
  //
  // kokoro-js resolves its voice files as path.resolve(__dirname,
  // "../voices/<voice>.bin"). Bundled, Turbopack rewrites __dirname to a
  // "/ROOT/..." placeholder, so every narration failed with "ENOENT ...
  // /ROOT/node_modules/kokoro-js/voices/af_heart.bin" even though the .bin
  // files are traced into the function. Loaded from node_modules instead,
  // __dirname is the real path. @huggingface/transformers is external too so
  // kokoro-js and src/lib/kokoro-tts.ts share one instance: the env.cacheDir
  // set there has to reach the copy kokoro-js loads the model with.
  serverExternalPackages: ["pdfkit", "kokoro-js", "@huggingface/transformers"],
  // The local sentence-embedding model (@xenova/transformers, used by
  // src/lib/embeddings.ts and src/lib/chunk-embeddings.ts) runs on
  // onnxruntime-node, whose .node binding dlopen()s libonnxruntime.so at
  // runtime. File tracing can't see a dlopen, so the binding was shipped
  // without its library and the model failed to load on Vercel
  // ("libonnxruntime.so.1.14.0: cannot open shared object file"), leaving
  // retrieval on the hashed fallback. Ship the Linux x64 runtime (16 MB)
  // with the routes that embed text at request time: RAG chat, semantic
  // search, related articles, recommendations and gap analysis.
  // /api/articles/workflow (publish-time indexing) is left out: it is
  // already ~225 MB and this would take it close to Vercel's 250 MB
  // function limit. Articles it indexes with the hashed fallback are
  // re-indexed with the real model by scripts/backfill-galleys.ts on the
  // next build.
  outputFileTracingIncludes: Object.fromEntries(
    [
      "/api/corpus-chat",
      "/api/articles/*/chat",
      "/api/articles/*/similar",
      "/api/search/semantic",
      "/api/recommendations",
      "/api/research-lab/gap-analysis",
    ]
      .map((route): [string, string[]] => [route, ["./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/*"]])
      // Share-image fonts (src/lib/og-card.tsx reads them from disk).
      .concat(
        ["/opengraph-image", "/article/[id]/opengraph-image", "/authors/[slug]/opengraph-image", "/pwa-icon/[size]"].map(
          (route): [string, string[]] => [route, ["./src/assets/fonts/*.ttf"]]
        )
      )
      // Kokoro voice embeddings (kokoro-js reads voices/*.bin from disk at runtime).
      .concat(
        [
          "/api/narration",
          "/api/admin/narration-jobs/*/retry",
          "/api/cron/narration-sweep",
          "/api/cron/sweep-all",
        ].map((route): [string, string[]] => [
          route,
          [
            "./node_modules/kokoro-js/voices/*.bin",
            // onnxruntime-node 1.21 native libs used by @huggingface/transformers.
            "./node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/*",
          ],
        ])
      )
  ),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
      {
        // Unauthenticated, GET-only metadata harvester feeds meant for
        // arbitrary third-party consumption — the only two routes that
        // legitimately need a wildcard CORS allowance. COUNTER5
        // (/api/reports/counter/**) is deliberately excluded: it's
        // SUSHI-protocol, consumed server-to-server (not browser JS) and
        // already gated by a per-institution API key, so browser CORS is
        // moot there and a wildcard would only widen the attack surface.
        source: "/api/oai-pmh/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        source: "/api/redif/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

// Sourcemap upload only activates when SENTRY_AUTH_TOKEN is set (a CI/CD
// secret, never committed) — without it this wrapper still applies error
// monitoring's build-time instrumentation but silently skips the upload
// step rather than failing the build, matching this repo's LiveMode
// convention of degrading, not erroring, when a credential is absent.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
