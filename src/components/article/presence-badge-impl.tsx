"use client";

// ---------------------------------------------------------------------------
// PresenceBadgeImpl — "N reading now", backed by src/lib/presence.ts's
// short-TTL Upstash Redis keys (not the WebSocket ws-service mini-service,
// which needs an always-on host outside Vercel's serverless model and
// isn't deployed — see presence.ts's file header). Silent (renders
// nothing) whenever presence isn't in live mode or fewer than 2 people are
// reading, rather than showing a manufactured "1 reading now".
//
// Loaded only once reader-presence-badge.tsx's visibility gate mounts it,
// so the heartbeat polling never starts for a reader who never scrolls
// this far.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

const PRESENCE_HEARTBEAT_MS = 20_000;

export function PresenceBadgeImpl({ articleId }: { articleId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storageKey = "epip-reader-session-id";
    let sessionId = sessionStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(storageKey, sessionId);
    }

    async function beat() {
      try {
        const res = await apiFetch<{ count: number; mode: "live" | "simulation" }>(
          `/api/articles/${articleId}/presence`,
          { method: "POST", body: JSON.stringify({ sessionId }) }
        );
        if (!cancelled) setCount(res.mode === "live" ? res.count : null);
      } catch {
        if (!cancelled) setCount(null);
      }
    }

    beat();
    const interval = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [articleId]);

  if (!count || count < 2) return null;

  return (
    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.76_0.11_294/0.3)] bg-[oklch(0.93_0.04_290)] px-3 py-1 text-xs font-medium text-[oklch(0.42_0.18_295)]">
      <Users className="h-3 w-3" />
      {count} reading now
    </div>
  );
}
