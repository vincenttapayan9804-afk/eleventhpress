import type { NextConfig } from "next";

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
  serverExternalPackages: ["pdfkit"],
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

export default nextConfig;
