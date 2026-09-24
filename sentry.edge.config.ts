import * as Sentry from "@sentry/nextjs";

/**
 * Edge-runtime error monitoring (src/proxy.ts and any edge API routes).
 * Loaded by src/instrumentation.ts's register() hook. See
 * sentry.server.config.ts for the no-DSN-means-no-op contract.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
});
