"use client";

// ---------------------------------------------------------------------------
// WaveformPlayer — public entry point. Lazy-loads WaveformPlayerImpl (which
// pulls in wavesurfer.js) only once actually rendered, keeping the library
// out of any bundle that merely imports this file.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import { Play } from "lucide-react";

const WaveformPlayerImpl = dynamic(
  () => import("./waveform-player-impl").then((m) => m.WaveformPlayerImpl),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/10 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 text-primary">
          <Play className="h-4 w-4" />
        </span>
        <div className="min-h-[44px] flex-1" />
      </div>
    ),
  }
);

export function WaveformPlayer({ src, className = "" }: { src: string; className?: string }) {
  return <WaveformPlayerImpl src={src} className={className} />;
}
