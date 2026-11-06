"use client";

// ---------------------------------------------------------------------------
// CorpusChatWidget — "Ask the Corpus", the journal's AI Research Assistant, available as a
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
import { ResearchMascot } from "@/components/research-assistant/mascot";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";

const CorpusChatPanel = dynamic(() => import("./corpus-chat-panel").then((m) => m.CorpusChatPanel), {
  ssr: false,
});

export function CorpusChatWidget() {
  const [everOpened, setEverOpened] = useState(false);
  const [open, setOpen] = useState(false);
  // Signing in or out switches where conversations are kept (account vs
  // this browser), so the assistant starts fresh rather than mixing them.
  const signedIn = useApp((s) => !!s.user);

  return (
    <>
      <Button
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
        className="group btn-royal-glow fixed bottom-5 right-5 z-30 flex h-12 items-center gap-2 overflow-visible rounded-full pl-2 pr-2 shadow-lg sm:pr-5"
        aria-label="Ask the Corpus"
      >
        <span className="-mt-3 flex h-10 w-9 items-end justify-center">
          <ResearchMascot size={36} />
        </span>
        <span className="hidden text-sm font-medium sm:inline">Ask the Corpus</span>
      </Button>

      {/* Only fetches/mounts the chat panel chunk after first interaction;
          stays mounted afterward so open/close toggling doesn't lose the
          conversation. */}
      {everOpened && <CorpusChatPanel key={signedIn ? "account" : "device"} open={open} onOpenChange={setOpen} />}
    </>
  );
}
