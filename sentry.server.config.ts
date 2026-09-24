import * as Sentry from "@sentry/nextjs";

/**
 * Server-runtime error monitoring. Loaded by src/instrumentation.ts's
 * register() hook — not auto-discovered by Next.js itself, unlike
 * instrumentation.ts/instrumentation-client.ts.
 *
 * Same LiveMode convention this repo already uses everywhere else
 * (Zenodo/VirusTotal/Meilisearch/…): Sentry.init with an empty dsn is a
 * documented no-op built into the SDK itself, so the app behaves
 * identically with or without SENTRY_DSN set — just without error
 * reporting until it is.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
});
