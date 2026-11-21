"use client";

import { CheckCheck } from "lucide-react";
import { MAX_SDG_TAGS, SDG_GOALS, type SdgSuggestion } from "@/lib/sdg";
import { cn } from "@/lib/utils";

/**
 * Pick up to MAX_SDG_TAGS UN Sustainable Development Goals. Shared by the
 * author submission form and the editor's confirmation panel.
 *
 * Chips are text in each goal's official UN colour (a colour swatch plus
 * the goal name), never a recoloured UN icon. Suggestions come from the
 * local, non-AI suggestSdgs(), so nothing about the manuscript leaves the
 * platform to produce them.
 */
export function SdgGoalPicker({
  value,
  onChange,
  suggestions = [],
  disabled = false,
  idPrefix = "sdg",
}: {
  value: number[];
  onChange: (next: number[]) => void;
  suggestions?: SdgSuggestion[];
  disabled?: boolean;
  idPrefix?: string;
}) {
  const suggested = new Map(suggestions.map((s) => [s.number, s]));
  const full = value.length >= MAX_SDG_TAGS;

  function toggle(n: number) {
    if (value.includes(n)) onChange(value.filter((x) => x !== n));
    else if (!full) onChange([...value, n]);
  }

  const unusedSuggestions = suggestions.filter((s) => !value.includes(s.number));

  return (
    <div className="space-y-2" data-testid={`${idPrefix}-picker`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {value.length} of {MAX_SDG_TAGS} selected
        </span>
        {unusedSuggestions.length > 0 && !disabled && (
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            onClick={() => onChange([...value, ...unusedSuggestions.map((s) => s.number)].slice(0, MAX_SDG_TAGS))}
            disabled={full}
          >
            <CheckCheck className="h-3 w-3" /> Use suggestions
          </button>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {SDG_GOALS.map((g) => {
          const on = value.includes(g.number);
          const s = suggested.get(g.number);
          const blocked = disabled || (!on && full);
          return (
            <li key={g.number}>
              <button
                type="button"
                data-testid={`${idPrefix}-chip-${g.number}`}
                aria-pressed={on}
                disabled={blocked}
                onClick={() => toggle(g.number)}
                title={s ? `Suggested because it mentions: ${s.matched.join(", ")}` : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-2 bg-muted/60 font-medium" : "border-border hover:bg-muted/40",
                  blocked && !on && "cursor-not-allowed text-muted-foreground"
                )}
                style={on ? { borderColor: g.color } : undefined}
              >
                <span
                  aria-hidden
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[0.65rem] font-bold text-white"
                  style={{ backgroundColor: g.color }}
                >
                  {g.number}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="sr-only">SDG {g.number}: </span>
                  {g.title}
                </span>
                {s && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-primary">
                    Suggested
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {suggestions.length > 0 && (
        <p className="text-[0.7rem] text-muted-foreground">
          Suggestions are a simple match of the title, abstract and keywords against each goal&rsquo;s keyword list. No
          AI is involved and the text is not sent anywhere to produce them.
        </p>
      )}
    </div>
  );
}
