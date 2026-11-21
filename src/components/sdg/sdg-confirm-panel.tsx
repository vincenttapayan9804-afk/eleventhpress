"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { parseSdgGoals, sdgGoal, suggestSdgs, type SdgStatus } from "@/lib/sdg";
import { Button } from "@/components/ui/button";
import { SdgGoalPicker } from "./sdg-goal-picker";

export interface SdgArticleFields {
  id: string;
  title?: string | null;
  abstract?: string | null;
  keywords?: string | null;
  discipline?: string | null;
  contentType?: string | null;
  sdgGoals?: string | null;
  sdgStatus?: string | null;
}

/** Short goal list for summaries, e.g. "SDG 4 · SDG 13". */
export function sdgShortList(goals: number[]): string {
  return goals.map((n) => `SDG ${n}`).join(" · ");
}

export function SdgStatusChip({ status, goals }: { status: SdgStatus; goals: number[] }) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> {goals.length ? `Confirmed: ${sdgShortList(goals)}` : "Confirmed: no goal applies"}
      </span>
    );
  }
  if (status === "PROPOSED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <Clock className="h-3 w-3" /> Pending confirmation: {sdgShortList(goals)}
      </span>
    );
  }
  return <span className="text-[0.65rem] text-muted-foreground">No goals proposed</span>;
}

/**
 * Editor view of one article's UN SDGs: the author's proposal (or, when
 * there is none, the local keyword suggestions) pre-filled, editable, and
 * confirmed with one click. Nothing is public until confirmed.
 */
export function SdgConfirmPanel({
  article,
  onConfirmed,
  compact = false,
}: {
  article: SdgArticleFields;
  onConfirmed?: (goals: number[]) => void;
  compact?: boolean;
}) {
  const initialStatus = (["NONE", "PROPOSED", "CONFIRMED"].includes(article.sdgStatus ?? "") ? article.sdgStatus : "NONE") as SdgStatus;
  const stored = parseSdgGoals(article.sdgGoals);
  const suggestions = useMemo(
    () =>
      suggestSdgs({
        title: article.title,
        abstract: article.abstract,
        keywords: article.keywords,
        discipline: article.contentType === "EXPERT_INSIGHT" ? null : article.discipline,
      }),
    [article.title, article.abstract, article.keywords, article.discipline, article.contentType]
  );

  const [status, setStatus] = useState<SdgStatus>(initialStatus);
  const [saved, setSaved] = useState<number[]>(stored);
  const [goals, setGoals] = useState<number[]>(
    initialStatus === "NONE" ? suggestions.map((s) => s.number) : stored
  );
  const [editing, setEditing] = useState(!compact);
  const [busy, setBusy] = useState(false);

  async function confirm(next: number[]) {
    setBusy(true);
    try {
      const res = await apiFetch<{ sdgGoals: number[] }>(`/api/articles/${article.id}/sdg`, {
        method: "POST",
        body: JSON.stringify({ goals: next }),
      });
      setStatus("CONFIRMED");
      setSaved(res.sdgGoals);
      setGoals(res.sdgGoals);
      if (compact) setEditing(false);
      toast.success(res.sdgGoals.length ? `SDGs confirmed: ${sdgShortList(res.sdgGoals)}` : "Recorded: no goal applies");
      onConfirmed?.(res.sdgGoals);
    } catch (e: any) {
      toast.error("Could not save the goals", { description: e?.message });
    } finally {
      setBusy(false);
    }
  }

  const unchanged = status === "CONFIRMED" && goals.length === saved.length && goals.every((g, i) => g === saved[i]);

  return (
    <div className="space-y-3" data-testid={`sdg-confirm-${article.id}`}>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">UN Sustainable Development Goals</p>
          <SdgStatusChip status={status} goals={saved} />
        </div>
      )}
      {!compact && status === "PROPOSED" && (
        <p className="text-xs text-muted-foreground">
          The author proposed these goals. Check them against the manuscript, change them if needed, then confirm.
          They appear on the published article only after you confirm.
        </p>
      )}
      {!compact && status === "NONE" && (
        <p className="text-xs text-muted-foreground">
          {suggestions.length
            ? "The author didn't choose any goals. The suggested ones below are pre-selected from the article's keywords; adjust and confirm, or record that no goal applies."
            : "The author didn't choose any goals and none match the article's keywords. Pick any that apply, or record that no goal applies."}
        </p>
      )}

      {compact && !editing ? (
        <div className="flex flex-wrap items-center gap-2">
          {goals.length ? (
            goals.map((n) => {
              const g = sdgGoal(n)!;
              return (
                <span key={n} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs" style={{ borderColor: g.color }}>
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: g.color }} />
                  SDG {n}: {g.title}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">No matching goals found</span>
          )}
        </div>
      ) : (
        <SdgGoalPicker idPrefix={`sdg-${article.id}`} value={goals} onChange={setGoals} suggestions={suggestions} disabled={busy} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "CONFIRMED" && compact && !editing ? (
          <SdgStatusChip status={status} goals={saved} />
        ) : (
          <>
            <Button size="sm" disabled={busy || unchanged || goals.length === 0} onClick={() => confirm(goals)} data-testid="sdg-confirm-button">
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
              {status === "CONFIRMED" ? "Save changes" : "Confirm goals"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy || (status === "CONFIRMED" && saved.length === 0)} onClick={() => confirm([])}>
              No goal applies
            </Button>
          </>
        )}
        {compact && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Change"}
          </Button>
        )}
      </div>
    </div>
  );
}
