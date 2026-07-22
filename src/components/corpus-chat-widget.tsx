"use client";

// ---------------------------------------------------------------------------
// CorpusChatWidget — "Ask the Corpus" journal-wide RAG chat, available as a
// floating widget on every page (as opposed to ArticleChatPanel in
// article-view.tsx, which is scoped to one article). Every answer is
// grounded only in passages retrieved across the journal's own published
// articles (src/lib/chunk-embeddings.ts's retrieveChunksAcrossCorpus(),
// src/app/api/corpus-chat/route.ts) — never general knowledge — and each
// citation links straight to its source article.
//
// This file only renders the floating trigger button — cheap enough to sit
// in the initial bundle everywhere it's mounted. The actual chat UI (state,
// message list, API calls) lives in corpus-chat-panel.tsx and is fetched
// via next/dynamic(ssr:false) only once someone clicks the trigger, so its
// JS never blocks the page it's floating on top of.
// ---------------------------------------------------------------------------

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const CorpusChatPanel = dynamic(() => import("./corpus-chat-panel").then((m) => m.CorpusChatPanel), {
  ssr: false,
});

export function CorpusChatWidget() {
  const [everOpened, setEverOpened] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
        className="btn-royal-glow fixed bottom-5 right-5 z-30 flex h-12 items-center gap-2 rounded-full px-5 shadow-lg"
        aria-label="Ask the Corpus"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden text-sm font-medium sm:inline">Ask the Corpus</span>
      </Button>

      {/* Only fetches/mounts the chat panel chunk after first interaction;
          stays mounted afterward so open/close toggling doesn't lose the
          conversation. */}
      {everOpened && <CorpusChatPanel open={open} onOpenChange={setOpen} />}
    </>
  );
}
