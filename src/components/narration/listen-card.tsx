"use client";

// ---------------------------------------------------------------------------
// ListenCard — checks whether an editor has generated one or more real
// Kokoro-82M narration audio files for this content item (src/lib/
// kokoro-tts.ts) and, if so, plays them — with a Male/Female persona picker
// when more than one was actually generated. Otherwise falls back to the
// original browser-native speechSynthesis widget (./narration-player, via
// src/components/article) so there's always a "Listen" option even when no
// one has generated a real narration yet.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NarrationPlayer } from "@/components/article/narration-player";

type ContentType = "ARTICLE" | "MAGAZINE_PIECE" | "MEDIA_POST";
type Kind = "paper" | "piece" | "post";

interface NarrationOut {
  voice: string;
  label: string;
  gender: "MALE" | "FEMALE" | null;
  status: string;
  audioUrl: string | null;
  durationSec: number | null;
}

interface NarrationStatusResponse {
  narrations: NarrationOut[];
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
  const [narrations, setNarrations] = useState<NarrationOut[]>([]);
  const [checked, setChecked] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<NarrationStatusResponse>(`/api/narration?contentType=${contentType}&contentId=${contentId}`)
      .then((res) => {
        if (cancelled) return;
        const completed = (res.narrations || []).filter((n) => n.status === "COMPLETED" && n.audioUrl);
        setNarrations(completed);
        setSelectedVoice(completed[0]?.voice ?? null);
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

  if (narrations.length > 0) {
    const active = narrations.find((n) => n.voice === selectedVoice) || narrations[0];
    return (
      <Card className="paper-card">
        <CardContent className="p-5">
          <p className="eyebrow flex items-center gap-1.5">
            <Volume2 className="h-3 w-3 text-primary" /> Listen
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A narrated audio version of this {kind === "paper" ? "article" : kind}{formatDuration(active.durationSec)}.
          </p>
          {narrations.length > 1 && (
            <Select value={active.voice} onValueChange={setSelectedVoice}>
              <SelectTrigger className="mt-3 h-8 text-xs"><SelectValue placeholder="Narration voice" /></SelectTrigger>
              <SelectContent>
                {narrations.map((n) => (
                  <SelectItem key={n.voice} value={n.voice}>{n.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <audio controls preload="none" className="mt-3 w-full" src={active.audioUrl!} key={active.voice}>
            Your browser does not support the audio element.
          </audio>
        </CardContent>
      </Card>
    );
  }

  return <NarrationPlayer title={title} abstract={abstract} bodyHtml={bodyHtml} kind={kind} />;
}
