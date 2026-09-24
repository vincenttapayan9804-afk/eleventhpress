import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side error monitoring. Auto-discovered by Next.js (must live
 * under src/, same as instrumentation.ts and proxy.ts) — replaces the
 * older sentry.client.config.ts convention, which @sentry/nextjs 11
 * deprecates under Turbopack.
 *
 * NEXT_PUBLIC_-prefixed because this file ships in the client bundle;
 * see sentry.server.config.ts for the no-DSN-means-no-op contract.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
});
