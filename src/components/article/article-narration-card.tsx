"use client";

// ---------------------------------------------------------------------------
// ArticleNarrationCard — page-scoped, ssr:false, visibility-gated entry
// point for the "Listen to this paper" widget. The real player
// (speechSynthesis wiring) lives in ./narration-player.tsx and is only
// fetched once this card scrolls near the viewport, keeping it off the
// article page's initial hydration cost.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import { LazyOnVisible } from "@/components/lazy-on-visible";

const NarrationPlayer = dynamic(() => import("./narration-player").then((m) => m.NarrationPlayer), {
  ssr: false,
});

export function ArticleNarrationCard(props: { title: string; abstract: string; bodyHtml: string | null }) {
  return (
    <LazyOnVisible>
      <NarrationPlayer {...props} />
    </LazyOnVisible>
  );
}
