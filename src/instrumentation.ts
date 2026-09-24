import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation hook (must live under src/, co-located with
 * src/app — see src/proxy.ts's comment; a repo-root instrumentation.ts
 * was never confirmed to run for the same reason proxy.ts wasn't).
 * Loads the runtime-appropriate Sentry config; both are no-ops until
 * SENTRY_DSN is set (see sentry.server.config.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
