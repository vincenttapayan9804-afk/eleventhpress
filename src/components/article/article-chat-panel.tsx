"use client";

// ---------------------------------------------------------------------------
// ArticleChatPanel — the "Ask this paper" tab's entry point. Loads the chat
// (markdown renderer, evidence panel, export actions) only when a reader
// opens the tab; see ./article-chat-panel-impl.tsx.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { ResearchMascot } from "@/components/research-assistant/mascot";

function Loading() {
  return (
    <Card className="paper-card">
      <CardContent className="flex items-center gap-3.5 p-5 sm:p-6">
        <ResearchMascot size={44} state="thinking" title="Loading the Research Assistant" />
        <p className="font-display text-lg font-semibold">Ask this paper</p>
      </CardContent>
    </Card>
  );
}

export const ArticleChatPanel = dynamic(() => import("./article-chat-panel-impl").then((m) => m.ArticleChatPanelImpl), {
  ssr: false,
  loading: Loading,
});
