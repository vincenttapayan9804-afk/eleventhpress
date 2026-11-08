"use client";

import { useState } from "react";
import { FilePenLine, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { loadDraft, savedAgo } from "@/lib/submission-draft";

/** Dashboard overview: "pick up where you left off" for an unfinished submission. */
export function ResumeDraftCard() {
  const user = useApp((s) => s.user);
  const openDashboard = useApp((s) => s.openDashboard);
  const [draft] = useState(() => (typeof window === "undefined" ? null : loadDraft(user?.id)));
  if (!draft) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 to-transparent px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <FilePenLine className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Continue your submission</p>
          <p className="truncate text-xs text-muted-foreground">
            {draft.title ? `“${draft.title}”` : "Untitled draft"} · step {draft.step} of 3 · saved {savedAgo(draft.savedAt)}
          </p>
        </div>
      </div>
      <Button size="sm" onClick={() => openDashboard("submit")}>
        Resume <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
