"use client";

// ---------------------------------------------------------------------------
// NarrationPlayer — "Listen to this paper" via the browser's native Web
// Speech API (window.speechSynthesis), not a paid cloud TTS vendor: zero
// API keys, zero per-request cost, works entirely client-side. Voice
// quality varies by browser/OS, but the capability itself is real and
// immediately available everywhere the API exists — feature-detected and
// hidden (never a fake "Listen" button) where it doesn't.
//
// Loaded only once article-narration-card.tsx (its ssr:false next/dynamic
// gate) decides the card is worth hydrating, so speechSynthesis wiring
// never ships as part of the article page's initial bundle.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Play, Pause, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const NARRATION_CHUNK_CHARS = 1800;

const KIND_LABEL: Record<string, string> = { paper: "paper", piece: "piece", post: "post" };

export function NarrationPlayer({
  title,
  abstract,
  bodyHtml,
  kind = "paper",
}: {
  title: string;
  abstract: string;
  bodyHtml: string | null;
  kind?: "paper" | "piece" | "post";
}) {
  const [state, setState] = useState<"idle" | "playing" | "paused" | "unsupported">("idle");

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setState("unsupported");
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function play() {
    const synth = window.speechSynthesis;
    if (state === "paused") {
      synth.resume();
      setState("playing");
      return;
    }
    synth.cancel();
    const bodyText = bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    const text = [title, abstract, bodyText].filter(Boolean).join(". ");
    if (!text.trim()) return;

    // Some browsers silently truncate very long utterances, so a long
    // article is split into back-to-back chunks rather than one giant one.
    const chunks = text.match(new RegExp(`[\\s\\S]{1,${NARRATION_CHUNK_CHARS}}(?:\\s|$)`, "g")) || [text];
    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (i === chunks.length - 1) {
        utterance.onend = () => setState("idle");
      }
      synth.speak(utterance);
    });
    setState("playing");
  }

  function pause() {
    window.speechSynthesis.pause();
    setState("paused");
  }

  function stop() {
    window.speechSynthesis.cancel();
    setState("idle");
  }

  if (state === "unsupported") return null;

  return (
    <Card className="paper-card">
      <CardContent className="p-5">
        <p className="eyebrow">Listen</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Have this {KIND_LABEL[kind]} read aloud using your browser&apos;s built-in narration.
        </p>
        <div className="mt-3 flex gap-2">
          {state === "playing" ? (
            <Button variant="outline" className="flex-1" onClick={pause}>
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={play}>
              <Play className="mr-2 h-4 w-4" /> {state === "paused" ? "Resume" : `Listen to this ${KIND_LABEL[kind]}`}
            </Button>
          )}
          {state !== "idle" && (
            <Button variant="ghost" size="icon" onClick={stop} aria-label="Stop">
              <Square className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
