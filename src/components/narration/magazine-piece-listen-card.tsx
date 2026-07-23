"use client";

// ---------------------------------------------------------------------------
// MagazinePieceListenCard — same ssr:false, visibility-gated pattern as
// src/components/article/article-narration-card.tsx, for a MagazinePiece.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import { LazyOnVisible } from "@/components/lazy-on-visible";

const ListenCard = dynamic(() => import("./listen-card").then((m) => m.ListenCard), {
  ssr: false,
});

export function MagazinePieceListenCard({
  pieceId,
  title,
  dek,
  bodyHtml,
}: {
  pieceId: string;
  title: string;
  dek: string | null;
  bodyHtml: string;
}) {
  return (
    <LazyOnVisible>
      <ListenCard contentType="MAGAZINE_PIECE" contentId={pieceId} title={title} abstract={dek || ""} bodyHtml={bodyHtml} kind="piece" />
    </LazyOnVisible>
  );
}
