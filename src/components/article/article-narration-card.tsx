"use client";

// ---------------------------------------------------------------------------
// ArticleNarrationCard — page-scoped, ssr:false, visibility-gated entry
// point for the "Listen to this paper" widget. Renders src/components/
// narration/listen-card.tsx, which prefers a real generated Kokoro-82M
// narration file over the browser-native speechSynthesis fallback — only
// fetched once this card scrolls near the viewport, keeping it off the
// article page's initial hydration cost.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import { LazyOnVisible } from "@/components/lazy-on-visible";

const ListenCard = dynamic(() => import("@/components/narration/listen-card").then((m) => m.ListenCard), {
  ssr: false,
});

export function ArticleNarrationCard({
  articleId,
  title,
  abstract,
  bodyHtml,
}: {
  articleId: string;
  title: string;
  abstract: string;
  bodyHtml: string | null;
}) {
  return (
    <LazyOnVisible>
      <ListenCard contentType="ARTICLE" contentId={articleId} title={title} abstract={abstract} bodyHtml={bodyHtml} kind="paper" />
    </LazyOnVisible>
  );
}
