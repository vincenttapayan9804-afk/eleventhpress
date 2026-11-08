"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Users, Clock3, CircleCheck, CircleAlert, CircleDashed } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface Timeline {
  status: string;
  next: string | null;
  events: { at: string; label: string; kind: "stage" | "review" | "decision" }[];
  review: { invited: number; declined: number; inProgress: number; completed: number; expectedBy: string | null };
  coAuthors: { name: string; status: string; respondedAt: string | null }[];
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** My Articles: an expandable, dated timeline of a submission's journey. */
export function SubmissionTracker({ articleId }: { articleId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Timeline | null>(null);
  const [error, setError] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      apiFetch<Timeline>(`/api/articles/${articleId}/timeline`).then(setData).catch(() => setError(true));
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide timeline" : "Track this submission"}
      </button>
      {open && (
        <div className="mt-3">
          {error ? (
            <p className="text-xs text-muted-foreground">The timeline couldn&rsquo;t be loaded.</p>
          ) : !data ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_240px]">
              <div>
                {data.next && (
                  <p className="mb-3 rounded-md bg-primary/5 px-3 py-2 text-xs">
                    <span className="font-semibold">What happens next: </span>
                    {data.next}
                  </p>
                )}
                <ol className="relative space-y-3 border-l border-border pl-4">
                  {data.events.map((e, i) => (
                    <li key={i} className="relative">
                      <span
                        className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
                          i === data.events.length - 1 ? "bg-primary" : "bg-muted-foreground/40"
                        }`}
                      />
                      <p className="text-sm font-medium">{e.label}</p>
                      <p className="text-[0.7rem] text-muted-foreground">{fmt(e.at)}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="space-y-3 text-xs">
                {data.review.invited > 0 && (
                  <div className="rounded-md border border-border p-3">
                    <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><Clock3 className="h-3.5 w-3.5" /> Peer review</p>
                    <p className="text-muted-foreground">
                      {data.review.completed} completed · {data.review.inProgress} in progress
                      {data.review.declined ? ` · ${data.review.declined} declined` : ""}
                    </p>
                    {data.review.expectedBy && (
                      <p className="mt-1 text-muted-foreground">Reviews due by {fmt(data.review.expectedBy)}</p>
                    )}
                  </div>
                )}
                {data.coAuthors.length > 0 && (
                  <div className="rounded-md border border-border p-3">
                    <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><Users className="h-3.5 w-3.5" /> Co-author confirmations</p>
                    <ul className="space-y-1">
                      {data.coAuthors.map((c, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          {c.status === "CONFIRMED" ? (
                            <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
                          ) : c.status === "DISPUTED" ? (
                            <CircleAlert className="h-3.5 w-3.5 text-amber-600" />
                          ) : (
                            <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="truncate">{c.name}</span>
                          <span className="ml-auto text-muted-foreground">
                            {c.status === "CONFIRMED" ? "Confirmed" : c.status === "DISPUTED" ? "Flagged" : "Waiting"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
