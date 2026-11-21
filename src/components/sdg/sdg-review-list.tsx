"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Globe2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SdgConfirmPanel, type SdgArticleFields } from "./sdg-confirm-panel";

const PAGE = 5;

/** Published articles whose UN SDGs no editor has confirmed yet. */
export function sdgReviewItems<T extends SdgArticleFields & { status?: string }>(queue: T[]): T[] {
  return queue.filter((a) => a.status === "PUBLISHED" && a.sdgStatus !== "CONFIRMED");
}

/**
 * One-off catch-up for articles published before SDG tagging existed: each
 * row comes pre-filled with the local keyword suggestions, so most need a
 * single "Confirm goals" or "No goal applies" click.
 */
export function SdgReviewList({ queue }: { queue: (SdgArticleFields & { status?: string })[] }) {
  // Rows confirmed in this session stay visible (as confirmed) after their click.
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const items = queue.filter((a) => a.status === "PUBLISHED" && (a.sdgStatus !== "CONFIRMED" || done.has(a.id)));
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);

  if (items.length === 0) return null;
  const remaining = items.length - done.size;

  return (
    <Card className="paper-card" data-testid="sdg-review-list">
      <CardContent className="p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-primary" />
            <span>
              <span className="block font-display text-sm font-semibold">SDG review for published articles</span>
              <span className="block text-xs text-muted-foreground">
                {remaining > 0
                  ? `${remaining} published article${remaining === 1 ? "" : "s"} still need${remaining === 1 ? "s its" : " their"} UN goals confirmed.`
                  : "All done. Every published article has its goals confirmed."}
              </span>
            </span>
          </span>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>

        {open && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Goals are pre-selected by matching each article&rsquo;s keywords against the UN goal keyword lists (no AI).
              Confirm them, change them, or record that no goal applies.
            </p>
            <ul className="space-y-3">
              {items.slice(0, shown).map((a) => (
                <li key={a.id} className="rounded-md border border-border p-3">
                  <p className="mb-2 text-sm font-medium leading-snug">{a.title}</p>
                  <SdgConfirmPanel
                    compact
                    article={a}
                    onConfirmed={() => setDone((s) => new Set(s).add(a.id))}
                  />
                </li>
              ))}
            </ul>
            {shown < items.length && (
              <Button size="sm" variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                Show {Math.min(PAGE, items.length - shown)} more
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
