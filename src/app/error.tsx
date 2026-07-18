"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary — previously absent entirely, meaning ANY
 * uncaught client-side render error (e.g. a WebGL context failing to
 * initialize under memory pressure, src/components/three-d/*) tore down
 * the whole page with nothing to show the visitor: the server had already
 * returned a clean 200, so this failure mode is invisible in server/
 * platform logs and looks exactly like "the site is down" from the
 * outside. This gives every route a real recovery UI instead.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="font-display text-2xl font-semibold text-primary">This page hit a snag</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Nothing was lost — this was a rendering error on this device, not a problem with your account or data.
        Reloading usually fixes it.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
