"use client";

import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS, DISCIPLINE_COLORS, parseAuthors } from "@/lib/article";
import type { ArticleStatus } from "@/lib/article";
import {
  Eye,
  Download,
  Quote,
  FileText,
  ArrowRight,
} from "lucide-react";
import { STATUS_FLOW } from "@/lib/article";

interface Props {
  submissions: any[];
  onRefresh: () => void;
}

export function AuthorArticlesTab({ submissions, onRefresh }: Props) {
  const { openArticle, openDashboard } = useApp();

  if (submissions.length === 0) {
    return (
      <Card className="paper-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-medium">No submissions yet</p>
          <p className="text-sm text-muted-foreground">
            Submit your first manuscript to begin the peer-review process.
          </p>
          <Button className="mt-4" onClick={() => openDashboard("submit")}>
            New submission <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {submissions.length} manuscript{submissions.length === 1 ? "" : "s"} total
        </p>
        <Button size="sm" onClick={() => openDashboard("submit")}>
          <FileText className="mr-1.5 h-3.5 w-3.5" /> New submission
        </Button>
      </div>

      {submissions.map((s) => {
        const status = s.status as ArticleStatus;
        const authors = parseAuthors(s.authors);
        const currentIdx = STATUS_FLOW.indexOf(status);
        return (
          <Card key={s.id} className="paper-card">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[s.discipline]}`}>
                      {s.discipline}
                    </Badge>
                    <Badge variant="outline" className={`border ${STATUS_COLORS[status]}`}>
                      {STATUS_LABELS[status]}
                    </Badge>
                    {s.doi && (
                      <span className="font-mono text-[0.65rem] text-muted-foreground">
                        DOI: {s.doi}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openArticle(s.id)}
                    className="mt-2 block text-left"
                  >
                    <h3 className="font-display text-base font-semibold leading-snug hover:text-primary">
                      {s.title}
                    </h3>
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {authors.map((a) => a.name).join(", ")}
                  </p>
                </div>
                <div className="flex gap-3 text-right text-xs text-muted-foreground">
                  <Stat icon={Quote} value={s.citations} label="cited" />
                  <Stat icon={Eye} value={s.views} label="viewed" />
                  <Stat icon={Download} value={s.downloads} label="downloaded" />
                </div>
              </div>

              {/* Progress bar */}
              {status !== "REJECTED" && status !== "WITHDRAWN" && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
                    {STATUS_FLOW.slice(0, 7).map((s2, i) => (
                      <span
                        key={s2}
                        className={`flex-1 truncate ${
                          i <= currentIdx ? "font-semibold text-primary" : ""
                        }`}
                      >
                        {STATUS_LABELS[s2]}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 flex gap-0.5">
                    {STATUS_FLOW.slice(0, 7).map((s2, i) => (
                      <div
                        key={s2}
                        className={`h-1 flex-1 rounded-full ${
                          i <= currentIdx ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews summary */}
              {s.reviews?.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="eyebrow mb-1">Peer-review status</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {s.reviews.map((r: any) => (
                      <Badge key={r.id} variant="outline" className="font-mono text-[0.6rem]">
                        {r.status}{r.recommendation ? ` · ${r.recommendation.replace("_", " ")}` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {s.plagiarismScore != null && (
                <p className="mt-3 font-mono text-[0.65rem] text-muted-foreground">
                  In-corpus similarity: {s.plagiarismScore}% · Review model: {s.reviewModel.replace("_", " ")}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="font-display text-sm font-semibold">{value}</span>
      <span className="text-[0.65rem] text-muted-foreground">{label}</span>
    </div>
  );
}
