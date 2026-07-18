"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the root layout itself (src/app/layout.tsx) —
 * error.tsx alone can't, since it renders inside the layout it's meant to
 * protect. Must render its own <html>/<body>: this fully replaces the root
 * layout when it fires, matching Next.js's documented requirement.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ maxWidth: 420, color: "#666", fontSize: "0.875rem" }}>
            This was a rendering error on this device, not a problem with your account or data. Reloading usually
            fixes it.
          </p>
          <button
            onClick={() => reset()}
            style={{
              borderRadius: 6,
              background: "#6B2D8E",
              color: "#fff",
              padding: "0.5rem 1rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
