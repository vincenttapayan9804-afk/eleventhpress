"use client";

import { useApp } from "@/lib/store";
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
} from "lucide-react";

interface Props {
  reviews: any[];
  onRefresh: () => void;
}

export function ReviewerQueueTab({ reviews, onRefresh }: Props) {
  const { openReviewerForm } = useApp();

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
                    <Button size="sm" onClick={() => openReviewerForm(r.id)}>
                      <PenSquare className="mr-1.5 h-3.5 w-3.5" />
                      {r.status === "INVITED" ? "Accept & start" : "Continue review"}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
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
    </div>
  );
}
