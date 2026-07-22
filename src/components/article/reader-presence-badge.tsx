"use client";

// ---------------------------------------------------------------------------
// ReaderPresenceBadge — page-scoped, ssr:false, visibility-gated entry
// point for the "N reading now" indicator. The real polling logic lives in
// ./presence-badge-impl.tsx and only loads (and only starts its heartbeat
// interval) once this badge scrolls near the viewport.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import { LazyOnVisible } from "@/components/lazy-on-visible";

const PresenceBadgeImpl = dynamic(() => import("./presence-badge-impl").then((m) => m.PresenceBadgeImpl), {
  ssr: false,
});

export function ReaderPresenceBadge({ articleId }: { articleId: string }) {
  return (
    <LazyOnVisible>
      <PresenceBadgeImpl articleId={articleId} />
    </LazyOnVisible>
  );
}
