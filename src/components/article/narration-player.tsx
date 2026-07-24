"use client";

// ---------------------------------------------------------------------------
// NarrationPlayer — "Listen to this paper" via the browser's native Web
// Speech API (window.speechSynthesis), not a paid cloud TTS vendor: zero
// API keys, zero per-request cost, works entirely client-side. Voice
// quality varies by browser/OS, but the capability itself is real and
// immediately available everywhere the API exists — feature-detected and
// hidden (never a fake "Listen" button) where it doesn't.
//
// When the browser exposes more than one distinctly-gendered system voice,
// a Male/Female picker is shown too — built from the browser's own real
// voice list (classified by a best-effort name heuristic, since the Web
// Speech API doesn't expose a gender field), never a fabricated choice.
//
// Loaded only once article-narration-card.tsx (its ssr:false next/dynamic
// gate) decides the card is worth hydrating, so speechSynthesis wiring
// never ships as part of the article page's initial bundle.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Play, Pause, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IconChip } from "@/components/icon-chip";

const NARRATION_CHUNK_CHARS = 1800;

const KIND_LABEL: Record<string, string> = { paper: "paper", piece: "piece", post: "post" };

// Common system voice names, by platform, that reliably identify as one
// gender — used only to group the browser's own real voice list into a
// Male/Female picker; a voice whose name doesn't match any of these is
// simply left out of the picker rather than guessed at.
const FEMALE_VOICE_HINTS = [
  "female", "samantha", "victoria", "karen", "moira", "tessa", "fiona", "zira",
  "susan", "aria", "jenny", "hazel", "kate", "salli", "joanna", "ivy", "kimberly",
];
const MALE_VOICE_HINTS = [
  "male", "alex", "daniel", "fred", "david", "mark", "george", "james",
  "guy", "eric", "ryan", "brian", "matthew", "justin", "arthur",
];

type VoiceGender = "FEMALE" | "MALE";

function classifyVoice(voice: SpeechSynthesisVoice): VoiceGender | null {
  const name = voice.name.toLowerCase();
  if (FEMALE_VOICE_HINTS.some((h) => name.includes(h))) return "FEMALE";
  if (MALE_VOICE_HINTS.some((h) => name.includes(h))) return "MALE";
  return null;
}

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
  const [genderVoices, setGenderVoices] = useState<Partial<Record<VoiceGender, SpeechSynthesisVoice>>>({});
  const [selectedGender, setSelectedGender] = useState<VoiceGender | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setState("unsupported");
      return;
    }

    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      const byGender: Partial<Record<VoiceGender, SpeechSynthesisVoice>> = {};
      for (const voice of voices) {
        const gender = classifyVoice(voice);
        if (gender && !byGender[gender]) byGender[gender] = voice;
      }
      setGenderVoices(byGender);
      setSelectedGender((prev) => prev ?? (byGender.FEMALE ? "FEMALE" : byGender.MALE ? "MALE" : null));
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
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

    const chosenVoice = selectedGender ? genderVoices[selectedGender] : undefined;

    // Some browsers silently truncate very long utterances, so a long
    // article is split into back-to-back chunks rather than one giant one.
    const chunks = text.match(new RegExp(`[\\s\\S]{1,${NARRATION_CHUNK_CHARS}}(?:\\s|$)`, "g")) || [text];
    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (chosenVoice) utterance.voice = chosenVoice;
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

  const hasGenderChoice = Boolean(genderVoices.FEMALE && genderVoices.MALE);

  return (
    <Card className="paper-card">
      <CardContent className="p-5">
        <p className="eyebrow">Listen</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {`Have this ${KIND_LABEL[kind]} read aloud using your browser's built-in narration.`}
        </p>
        {hasGenderChoice && (
          <Select value={selectedGender ?? undefined} onValueChange={(v) => setSelectedGender(v as VoiceGender)}>
            <SelectTrigger className="mt-3 h-8 text-xs"><SelectValue placeholder="Narrator voice" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FEMALE">Female voice</SelectItem>
              <SelectItem value="MALE">Male voice</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="mt-3 flex gap-2">
          {state === "playing" ? (
            <Button variant="outline" className="flex-1" onClick={pause}>
              <IconChip icon={Pause} /> Pause
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={play}>
              <IconChip icon={Play} /> {state === "paused" ? "Resume" : `Listen to this ${KIND_LABEL[kind]}`}
            </Button>
          )}
          {state !== "idle" && (
            <Button variant="ghost" size="icon" onClick={stop} aria-label="Stop">
              <Square className="h-4 w-4 text-primary" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
