"use client";

// ---------------------------------------------------------------------------
// WaveformPlayerImpl — the actual wavesurfer.js-backed player. Split out from
// waveform-player.tsx so the wavesurfer.js bundle only downloads once this
// module is dynamically imported (next/dynamic ssr:false), matching this
// codebase's established heavy-widget pattern (src/components/pdf-preview.tsx,
// src/components/article/galley-translation-panel-impl.tsx).
//
// Stays in an "idle" state — no WaveSurfer instance, no network request —
// until the reader presses Play. wavesurfer has to fetch and decode the
// entire audio file up front to compute waveform peaks (there's no
// pre-computed peaks data for narration audio here), so initializing it
// eagerly on mount would silently start downloading a multi-minute
// narration file the moment this card scrolls into view. Waiting for an
// explicit tap preserves the same "don't fetch until asked" behavior the
// native <audio preload="none"> element this replaces already had.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const BRAND_PURPLE = "#4c1d95";
const BRAND_GOLD = "#c9a55c";
const WAVE_TRACK = "#ded3f0";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WaveformPlayerImpl({ src, className = "" }: { src: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!started || !containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: WAVE_TRACK,
      progressColor: BRAND_PURPLE,
      cursorColor: BRAND_GOLD,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 44,
      url: src,
      normalize: true,
    });
    waveSurferRef.current = ws;

    ws.on("ready", () => {
      setReady(true);
      setDuration(ws.getDuration());
      ws.play();
    });
    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));
    ws.on("error", () => setFailed(true));

    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, [started, src]);

  function togglePlay() {
    if (!started) {
      setStarted(true);
      return;
    }
    waveSurferRef.current?.playPause();
  }

  if (failed) {
    return (
      <div className={`flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 p-3 text-sm text-muted-foreground ${className}`}>
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        Couldn&apos;t load this narration. Try again in a moment.
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 rounded-md border border-border/60 bg-muted/10 p-3 ${className}`}>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 shrink-0 rounded-full border-primary/30 text-primary"
        onClick={togglePlay}
        disabled={started && !ready}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div ref={containerRef} className="min-h-[44px] min-w-0 flex-1" />
      {started && (
        <span className="w-16 shrink-0 text-right text-[0.7rem] tabular-nums text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      )}
    </div>
  );
}
