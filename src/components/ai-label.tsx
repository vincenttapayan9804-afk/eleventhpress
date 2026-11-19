"use client";

import { Cpu } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Visible "AI-generated" disclosure (EU AI Act Article 50 transparency;
 * COPE's position on AI). Put it next to any text or image the platform
 * generated with AI, so readers can always tell it apart from the
 * authors' and editors' own words. `what` names the output for the
 * tooltip ("answer", "summary", "translation").
 */
export function AiLabel({ what = "content", className }: { what?: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground",
            className
          )}
          data-ai-generated="true"
          tabIndex={0}
        >
          <Cpu className="h-3 w-3" aria-hidden="true" />
          AI-generated
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        This {what} was generated with AI from the published article text. It can contain errors — check it against
        the source.
      </TooltipContent>
    </Tooltip>
  );
}
