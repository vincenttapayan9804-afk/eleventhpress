"use client";

// ---------------------------------------------------------------------------
// MediaPostListenCard — same ssr:false, visibility-gated pattern as
// src/components/article/article-narration-card.tsx, for a MediaPost.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import { LazyOnVisible } from "@/components/lazy-on-visible";

const ListenCard = dynamic(() => import("./listen-card").then((m) => m.ListenCard), {
  ssr: false,
});

export function MediaPostListenCard({
  postId,
  title,
  dek,
  bodyHtml,
}: {
  postId: string;
  title: string;
  dek: string | null;
  bodyHtml: string;
}) {
  return (
    <LazyOnVisible>
      <ListenCard contentType="MEDIA_POST" contentId={postId} title={title} abstract={dek || ""} bodyHtml={bodyHtml} kind="post" />
    </LazyOnVisible>
  );
}
