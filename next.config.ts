import type { NextConfig } from "next";

// Fairly permissive on script/style since this app ships an MDX editor,
// PDF.js, and a react-three-fiber canvas that haven't been verified against
// a strict nonce-based CSP yet — tightening that is a follow-up, not
// attempted here. The frame/base/form vectors are locked down hard instead,
// which is where this app's actual attack surface (XSS exfiltration via
// clickjacking/base-tag/form-hijack) actually lives.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
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
