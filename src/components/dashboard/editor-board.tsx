"use client";

import { useState } from "react";
import { AlertTriangle, GripVertical, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { STATUS_LABELS, type ArticleStatus } from "@/lib/article";

const COLUMNS: { status: ArticleStatus; action: string | null; hint: string }[] = [
  { status: "SUBMITTED", action: null, hint: "Screen for scope and quality" },
  { status: "UNDER_REVIEW", action: "SEND_TO_REVIEW", hint: "With reviewers" },
  { status: "REVISIONS_REQUIRED", action: "REQUEST_REVISIONS", hint: "Waiting on authors" },
  { status: "ACCEPTED", action: "ACCEPT", hint: "Awaiting payment" },
  { status: "IN_PRODUCTION", action: "SEND_TO_PRODUCTION", hint: "Typesetting" },
  { status: "PUBLISHED", action: "PUBLISH", hint: "Live" },
];

const DAY = 86400000;

function daysSince(iso?: string) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));
}

/**
 * Editorial queue as a pipeline board: one column per stage, a card per
 * manuscript with time in stage, review progress and overdue reviewers.
 * Drag a card to another column (or use its Move menu) to make that
 * decision — always confirmed first, since decisions email authors, issue
 * invoices and publish.
 */
export function EditorBoard({ queue, onOpen, onRefresh }: { queue: any[]; onOpen: (a: any) => void; onRefresh: () => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [pending, setPending] = useState<{ article: any; to: (typeof COLUMNS)[number] } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const byStatus = (s: string) => {
    const list = queue.filter((a) => a.status === s);
    return s === "PUBLISHED" ? list.slice(0, 8) : list;
  };

  const request = (article: any, status: string) => {
    const to = COLUMNS.find((c) => c.status === status);
    if (!to || !to.action || article.status === status) return;
    setNote("");
    setPending({ article, to });
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await apiFetch("/api/articles/workflow", {
        method: "POST",
        body: JSON.stringify({ articleId: pending.article.id, action: pending.to.action, note: note.trim() || undefined }),
      });
      toast.success(`Moved to ${STATUS_LABELS[pending.to.status]}`);
      setPending(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {COLUMNS.map((col) => {
          const cards = byStatus(col.status);
          return (
            <section
              key={col.status}
              aria-label={STATUS_LABELS[col.status]}
              onDragOver={(e) => {
                if (col.action) {
                  e.preventDefault();
                  setOverCol(col.status);
                }
              }}
              onDragLeave={() => setOverCol((c) => (c === col.status ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                const a = queue.find((x) => x.id === dragId);
                if (a) request(a, col.status);
                setDragId(null);
              }}
              className={`flex w-72 flex-shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors ${
                overCol === col.status ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <header className="flex items-center justify-between px-3 pb-2 pt-3">
                <div>
                  <p className="text-sm font-semibold">{STATUS_LABELS[col.status]}</p>
                  <p className="text-[0.7rem] text-muted-foreground">{col.hint}</p>
                </div>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">{queue.filter((a) => a.status === col.status).length}</span>
              </header>
              <div className="flex min-h-[120px] flex-col gap-2 px-2 pb-3">
                {cards.map((a) => {
                  const reviews: any[] = a.reviews ?? [];
                  const active = reviews.filter((r) => r.status !== "DECLINED");
                  const done = reviews.filter((r) => r.status === "COMPLETED").length;
                  const overdue = reviews.some((r) => ["ACCEPTED", "IN_PROGRESS"].includes(r.status) && r.dueDate && new Date(r.dueDate).getTime() < Date.now());
                  const age = daysSince(a.updatedAt ?? a.submittedAt ?? a.createdAt);
                  return (
                    <article
                      key={a.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(a.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragId(null)}
                      className={`group rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${dragId === a.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-grab text-muted-foreground/50" aria-hidden />
                        <button type="button" onClick={() => onOpen(a)} className="text-left text-sm font-medium leading-snug hover:text-primary">
                          {a.title}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5 text-[0.7rem] text-muted-foreground">
                        <span>{a.discipline}</span>
                        {age !== null && <span>· {age === 0 ? "today" : `${age}d in stage`}</span>}
                      </div>
                      {(active.length > 0 || overdue) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                          {active.length > 0 && (
                            <Badge variant="outline" className="gap-1 text-[0.65rem]"><Users className="h-3 w-3" /> {done}/{active.length} reviews</Badge>
                          )}
                          {overdue && (
                            <Badge variant="outline" className="gap-1 border-rose-300 bg-rose-50 text-[0.65rem] text-rose-700"><AlertTriangle className="h-3 w-3" /> Overdue</Badge>
                          )}
                        </div>
                      )}
                      <div className="mt-2 pl-5">
                        <Select value="" onValueChange={(v) => request(a, v)}>
                          <SelectTrigger className="h-7 w-full text-xs" aria-label={`Move “${a.title}” to another stage`}>
                            <SelectValue placeholder="Move to…" />
                          </SelectTrigger>
                          <SelectContent>
                            {COLUMNS.filter((c) => c.action && c.status !== a.status).map((c) => (
                              <SelectItem key={c.status} value={c.status} className="text-xs">{STATUS_LABELS[c.status]}</SelectItem>
                            ))}
                            <SelectItem value="REJECTED" className="text-xs text-destructive" disabled>Reject — open the manuscript</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </article>
                  );
                })}
                {cards.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to {pending ? STATUS_LABELS[pending.to.status] : ""}?</DialogTitle>
            <DialogDescription className="line-clamp-2">{pending?.article.title}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pending?.to.status === "PUBLISHED"
              ? "This publishes the article: it registers the DOI, generates galleys and indexes it."
              : pending?.to.status === "ACCEPTED"
                ? "The author is told and the publication-charge invoice is issued."
                : "The corresponding author is notified of the new stage."}
          </p>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Internal note (optional — never shown to the author)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
