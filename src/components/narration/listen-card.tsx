"use client";

// ---------------------------------------------------------------------------
// ListenCard — checks whether an editor has generated a real Kokoro-82M
// narration audio file for this content item (src/lib/kokoro-tts.ts) and, if
// so, plays that. Otherwise falls back to the original browser-native
// speechSynthesis widget (./narration-player, via src/components/article) so
// there's always a "Listen" option even when no one has generated one yet.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { NarrationPlayer } from "@/components/article/narration-player";

type ContentType = "ARTICLE" | "MAGAZINE_PIECE" | "MEDIA_POST";
type Kind = "paper" | "piece" | "post";

interface NarrationStatusResponse {
  status: string | null;
  audioUrl: string | null;
  durationSec: number | null;
}

function formatDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return ` (${m}:${String(s).padStart(2, "0")})`;
}

export function ListenCard({
  contentType,
  contentId,
  title,
  abstract,
  bodyHtml,
  kind = "paper",
}: {
  contentType: ContentType;
  contentId: string;
  title: string;
  abstract: string;
  bodyHtml: string | null;
  kind?: Kind;
}) {
  const [narration, setNarration] = useState<NarrationStatusResponse | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<NarrationStatusResponse>(`/api/narration?contentType=${contentType}&contentId=${contentId}`)
      .then((res) => {
        if (!cancelled) setNarration(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contentType, contentId]);

  if (!checked) return null;

  if (narration?.status === "COMPLETED" && narration.audioUrl) {
    return (
      <Card className="paper-card">
        <CardContent className="p-5">
          <p className="eyebrow">Listen</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A narrated audio version of this {kind === "paper" ? "article" : kind}{formatDuration(narration.durationSec)}.
          </p>
          <audio controls preload="none" className="mt-3 w-full" src={narration.audioUrl}>
            Your browser does not support the audio element.
          </audio>
        </CardContent>
      </Card>
    );
  }

  return <NarrationPlayer title={title} abstract={abstract} bodyHtml={bodyHtml} kind={kind} />;
}
