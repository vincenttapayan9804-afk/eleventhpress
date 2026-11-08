"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS, DISCIPLINE_COLORS } from "@/lib/article";
import {
  PenSquare,
  Clock,
  CheckCircle2,
  ArrowRight,
  XCircle,
  Calendar,
  Check,
  X,
  Loader2,
} from "lucide-react";

function dueBadge(dueDate?: string | null, status?: string) {
  if (!dueDate || !["ACCEPTED", "IN_PROGRESS"].includes(status || "")) return null;
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, cls: "border-rose-300 bg-rose-50 text-rose-700" };
  if (days <= 3) return { label: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`, cls: "border-amber-300 bg-amber-50 text-amber-800" };
  return null;
}

interface Props {
  reviews: any[];
  onRefresh: () => void;
}

export function ReviewerQueueTab({ reviews, onRefresh }: Props) {
  const { openReviewerForm } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [suggestion, setSuggestion] = useState("");

  async function respond(id: string, action: "ACCEPT" | "DECLINE") {
    setBusyId(id);
    try {
      await apiFetch(`/api/reviews/${id}/respond`, {
        method: "POST",
        body: JSON.stringify(action === "DECLINE" ? { action, reason, suggestedReviewer: suggestion } : { action }),
      });
      toast.success(action === "ACCEPT" ? "Invitation accepted — thank you!" : "Invitation declined. The editor has been told.");
      setDeclining(null);
      setReason("");
      setSuggestion("");
      onRefresh();
      if (action === "ACCEPT") openReviewerForm(id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const active = reviews.filter((r) => ["INVITED", "ACCEPTED", "IN_PROGRESS"].includes(r.status));
  const completed = reviews.filter((r) => r.status === "COMPLETED");
  const declined = reviews.filter((r) => r.status === "DECLINED");

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="paper-card">
          <CardContent className="p-4">
            <Clock className="h-4 w-4 text-amber-600" />
            <p className="mt-1.5 font-display text-2xl font-semibold">{active.length}</p>
            <p className="text-xs text-muted-foreground">Active invitations</p>
          </CardContent>
        </Card>
        <Card className="paper-card">
          <CardContent className="p-4">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="mt-1.5 font-display text-2xl font-semibold">{completed.length}</p>
            <p className="text-xs text-muted-foreground">Completed reviews</p>
          </CardContent>
        </Card>
        <Card className="paper-card">
          <CardContent className="p-4">
            <XCircle className="h-4 w-4 text-rose-600" />
            <p className="mt-1.5 font-display text-2xl font-semibold">{declined.length}</p>
            <p className="text-xs text-muted-foreground">Declined</p>
          </CardContent>
        </Card>
      </div>

      {/* Active reviews */}
      <Card className="paper-card">
        <CardContent className="p-5">
          <p className="eyebrow mb-3">Active review invitations</p>
          {active.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active invitations. The editor will assign reviews based on your expertise.
            </p>
          ) : (
            <div className="space-y-3">
              {active.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[r.article?.discipline]}`}>
                          {r.article?.discipline}
                        </Badge>
                        <Badge variant="outline" className={`border ${STATUS_COLORS[r.status as keyof typeof STATUS_COLORS] || "border-stone-300 bg-stone-100 text-stone-700"}`}>
                          {r.status}
                        </Badge>
                        {(() => {
                          const due = dueBadge(r.dueDate, r.status);
                          return due ? <Badge variant="outline" className={`border ${due.cls}`}>{due.label}</Badge> : null;
                        })()}
                        <span className="font-mono text-[0.6rem] text-muted-foreground">
                          {r.article?.doi || "no DOI"}
                        </span>
                      </div>
                      <h3 className="mt-2 font-display text-base font-semibold leading-snug">
                        {r.article?.title}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Due {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"} ·
                        Review model: {r.article?.reviewModel.replace(/_/g, " ") || "—"}
                      </p>
                      {r.article?.reviewModel === "DOUBLE_BLIND" && (
                        <p className="mt-2 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[0.7rem] text-violet-700">
                          Double-blind review — author names, affiliations, and acknowledgements
                          have been stripped from the manuscript PDF. Please do not attempt to
                          identify the authors.
                        </p>
                      )}
                    </div>
                    {r.status === "INVITED" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => setDeclining(r)}>
                          <X className="mr-1.5 h-3.5 w-3.5" /> Decline
                        </Button>
                        <Button size="sm" disabled={busyId === r.id} onClick={() => respond(r.id, "ACCEPT")}>
                          {busyId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                          Accept
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => openReviewerForm(r.id)}>
                        <PenSquare className="mr-1.5 h-3.5 w-3.5" />
                        {r.status === "ACCEPTED" ? "Start review" : "Continue review"}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed reviews */}
      {completed.length > 0 && (
        <Card className="paper-card">
          <CardContent className="p-5">
            <p className="eyebrow mb-3">Completed reviews</p>
            <div className="space-y-2">
              {completed.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.article?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Completed {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"} ·
                      Score {r.overallScore}/5
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-2 text-[0.6rem]">
                    {r.recommendation?.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={!!declining} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this invitation?</DialogTitle>
            <DialogDescription className="line-clamp-2">{declining?.article?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="decline-reason" className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                id="decline-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. outside my expertise, conflict of interest, no time before the due date"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="decline-suggest" className="text-sm font-medium">Suggest another reviewer (optional)</label>
              <Input id="decline-suggest" value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="Name and email" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busyId === declining?.id} onClick={() => declining && respond(declining.id, "DECLINE")}>
              {busyId === declining?.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Decline invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
