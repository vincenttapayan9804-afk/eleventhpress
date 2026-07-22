"use client";

// ---------------------------------------------------------------------------
// GalleyTranslationPanelImpl — full-text (not just abstract) translation of
// the article body into the site's current non-English locale
// (src/lib/galley-translation.ts, src/app/api/articles/[id]/
// translate-galley/route.ts). Reads back any existing translation on
// mount; an editor or the corresponding author can trigger one on demand.
// Never presents a partial/truncated translation as complete — mode
// "partial" always shows its own explicit note.
//
// Loaded only once galley-translation-panel.tsx's visibility gate mounts
// it, so the read-back fetch never fires for a reader who never scrolls
// this far into the article.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

export function GalleyTranslationPanelImpl({
  articleId,
  locale,
  canTranslate,
}: {
  articleId: string;
  locale: string;
  canTranslate: boolean;
}) {
  const [state, setState] = useState<"loading" | "none" | "ready">("loading");
  const [text, setText] = useState("");
  const [mode, setMode] = useState("");
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(true);

  useEffect(() => {
    setState("loading");
    apiFetch<{ mode: string; translatedText?: string }>(
      `/api/articles/${articleId}/translate-galley?locale=${locale}`
    )
      .then((res) => {
        if (res.mode === "not-translated" || res.mode === "heuristic") {
          setState("none");
        } else {
          setText(res.translatedText || "");
          setMode(res.mode);
          setState("ready");
        }
      })
      .catch(() => setState("none"));
  }, [articleId, locale]);

  async function translateNow() {
    setTranslating(true);
    try {
      const res = await apiFetch<{ translatedText: string; mode: string }>(
        `/api/articles/${articleId}/translate-galley`,
        { method: "POST", body: JSON.stringify({ locale }) }
      );
      if (res.mode === "heuristic") {
        toast.error("Translation isn't available for this deployment right now.");
      } else {
        setText(res.translatedText);
        setMode(res.mode);
        setState("ready");
        setShowTranslated(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  if (state === "loading") return null;

  if (state === "none") {
    if (!canTranslate) return null;
    return (
      <div className="not-prose mt-4 rounded-md border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          A full-text translation of this article isn&apos;t available yet in this language.
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={translateNow} disabled={translating}>
          {translating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Translate full article
        </Button>
      </div>
    );
  }

  return (
    <div className="not-prose mt-4 rounded-md border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Full-text translation</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[0.65rem] text-muted-foreground"
          onClick={() => setShowTranslated((v) => !v)}
        >
          {showTranslated ? "Hide" : "Show"}
        </Button>
      </div>
      {mode === "partial" && (
        <p className="mt-1 text-[0.7rem] italic text-amber-700">
          This translation covers only part of the article — the source text was too long to translate in full in one pass.
        </p>
      )}
      {showTranslated && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{text}</p>
      )}
      {canTranslate && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 h-6 text-[0.65rem] text-muted-foreground"
          onClick={translateNow}
          disabled={translating}
        >
          {translating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />} Re-translate
        </Button>
      )}
    </div>
  );
}
