"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DISCIPLINE_COLORS,
  parseAuthors,
} from "@/lib/article";
import type { ArticleStatus } from "@/lib/article";
import { TriagePanel } from "@/components/dashboard/triage-panel";
import {
  ListChecks,
  Clock,
  CheckCircle2,
  FileText,
  UserCheck,
  ArrowRight,
  Loader2,
  PenSquare,
  Sparkles,
  XCircle,
  Send,
  Users,
  Eye,
  EyeOff,
  FileDown,
  Globe2,
} from "lucide-react";

interface Props {
  queue: any[];
  stats?: { published: number; inReview: number; accepted: number; submitted: number };
  onRefresh: () => void;
}

const ACTIONS: { key: string; label: string; target: ArticleStatus; icon: any; color: string; requireNote?: boolean }[] = [
  { key: "SEND_TO_REVIEW", label: "Send to review", target: "UNDER_REVIEW", icon: Send, color: "default" },
  { key: "REQUEST_REVISIONS", label: "Request revisions", target: "REVISIONS_REQUIRED", icon: PenSquare, color: "outline" },
  { key: "ACCEPT", label: "Accept", target: "ACCEPTED", icon: CheckCircle2, color: "default" },
  { key: "REJECT", label: "Reject", target: "REJECTED", icon: XCircle, color: "destructive" },
  { key: "SEND_TO_PRODUCTION", label: "Send to production", target: "IN_PRODUCTION", icon: Sparkles, color: "default" },
  { key: "PUBLISH", label: "Publish & index", target: "PUBLISHED", icon: Sparkles, color: "default" },
];

export function EditorQueueTab({ queue, stats, onRefresh }: Props) {
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);

  const filtered = filter === "ALL" ? queue : queue.filter((a) => a.status === filter);

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard icon={Clock} label="Submitted" value={stats.submitted} color="text-amber-600" />
          <StatCard icon={PenSquare} label="Under review" value={stats.inReview} color="text-violet-600" />
          <StatCard icon={CheckCircle2} label="Accepted" value={stats.accepted} color="text-emerald-600" />
          <StatCard icon={FileText} label="Published" value={stats.published} color="text-primary" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {["ALL", "SUBMITTED", "UNDER_REVIEW", "REVISIONS_REQUIRED", "ACCEPTED", "IN_PRODUCTION"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-card text-foreground/70 hover:bg-accent"
            }`}
          >
            {s === "ALL" ? "All" : STATUS_LABELS[s as ArticleStatus]}
          </button>
        ))}
      </div>

      {/* Queue */}
      {filtered.length === 0 ? (
        <Card className="paper-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-display text-lg font-medium">Queue is empty</p>
            <p className="text-sm text-muted-foreground">
              No articles match this filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const authors = parseAuthors(a.authors);
            return (
              <Card key={a.id} className="paper-card">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[a.discipline]}`}>
                          {a.discipline}
                        </Badge>
                        <Badge variant="outline" className={`border ${STATUS_COLORS[a.status as ArticleStatus]}`}>
                          {STATUS_LABELS[a.status as ArticleStatus]}
                        </Badge>
                        <span className="font-mono text-[0.65rem] text-muted-foreground">
                          {a.doi || "no DOI"}
                        </span>
                        <span className="text-[0.65rem] text-muted-foreground">
                          Submitted {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                      <h3 className="mt-2 font-display text-base font-semibold leading-snug">
                        {a.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Corresponding: {a.author?.fullName || authors[0]?.name || "—"} · {a.author?.affiliation || authors[0]?.affiliation || ""}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.abstract}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedArticle(a)}
                    >
                      Open <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>

                  {/* Reviewers summary */}
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="eyebrow mb-1.5">
                      Reviewers ({a.reviews.length})
                    </p>
                    {a.reviews.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No reviewers assigned yet. Open the article to invite reviewers.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {a.reviews.map((r: any) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
                          >
                            <span className="font-mono text-[0.65rem] text-muted-foreground">
                              {r.status}
                            </span>
                            <span className="font-medium">
                              {r.reviewer?.fullName}
                            </span>
                            {r.recommendation && (
                              <Badge variant="outline" className="text-[0.55rem]">
                                {r.recommendation.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Article detail dialog */}
      <ArticleDialog
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function ArticleDialog({ article, onClose, onRefresh }: { article: any | null; onClose: () => void; onRefresh: () => void }) {
  const [action, setAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [assigningReviewer, setAssigningReviewer] = useState<string | null>(null);
  const [openAssigner, setOpenAssigner] = useState(false);
  const [togglingOpenReview, setTogglingOpenReview] = useState(false);
  const [depositingCrossref, setDepositingCrossref] = useState(false);
  const [generatingGalley, setGeneratingGalley] = useState(false);

  if (!article) return null;

  async function loadReviewers() {
    try {
      const res = await apiFetch<{ reviewers: any[] }>(
        `/api/articles/assign-reviewer?articleId=${article.id}`
      );
      setReviewers(res.reviewers);
    } catch (e: any) {
      toast.error("Failed to load reviewers");
    }
  }

  async function assignReviewer(reviewerId: string) {
    setAssigningReviewer(reviewerId);
    try {
      await apiFetch("/api/articles/assign-reviewer", {
        method: "POST",
        body: JSON.stringify({ articleId: article.id, reviewerId }),
      });
      toast.success("Reviewer invited", {
        description: "An in-app + email notification has been sent.",
      });
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAssigningReviewer(null);
    }
  }

  async function applyAction() {
    if (!action) return;
    setLoading(true);
    try {
      await apiFetch("/api/articles/workflow", {
        method: "POST",
        body: JSON.stringify({
          articleId: article.id,
          action,
          note: note || undefined,
        }),
      });
      toast.success("Workflow transition applied", {
        description: `Article moved to ${ACTIONS.find(a => a.key === action)?.target.replace(/_/g, " ")}`,
      });
      setAction(null);
      setNote("");
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!article} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Editorial control · {article.title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3 epip-scroll">
          <div className="space-y-5">
            {/* Article meta */}
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <MetaRow label="Discipline" value={
                <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[article.discipline]}`}>
                  {article.discipline}
                </Badge>
              } />
              <MetaRow label="Status" value={
                <Badge variant="outline" className={`border ${STATUS_COLORS[article.status as ArticleStatus]}`}>
                  {STATUS_LABELS[article.status as ArticleStatus]}
                </Badge>
              } />
              <MetaRow label="DOI" value={<code className="font-mono">{article.doi || "—"}</code>} />
              <MetaRow label="Review model" value={article.reviewModel.replace("_", " ")} />
              <MetaRow label="Plagiarism score" value={`${article.plagiarismScore ?? "—"}% (iThenticate)`} />
              <MetaRow label="Submitted" value={article.submittedAt ? new Date(article.submittedAt).toLocaleString() : "—"} />
            </div>

            <Separator />

            {/* Abstract */}
            <div>
              <p className="eyebrow mb-1">Abstract</p>
              <p className="text-xs leading-relaxed text-foreground/80">{article.abstract}</p>
            </div>

            {/* Reviewer assignment */}
            <div>
              <div className="flex items-center justify-between">
                <p className="eyebrow">Assigned reviewers</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpenAssigner(true);
                    loadReviewers();
                  }}
                >
                  <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Invite reviewer
                </Button>
              </div>
              {article.reviews.length === 0 ? (
                <p className="mt-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No reviewers assigned yet. The Manuscript Service has already generated an
                  anonymised PDF for double-blind review.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {article.reviews.map((r: any) => (
                    <div key={r.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{r.reviewer?.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.reviewer?.affiliation}
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[0.6rem]">
                          {r.status}
                        </Badge>
                      </div>
                      {r.recommendation && (
                        <div className="mt-2 border-t border-border pt-2 text-xs">
                          <p className="text-muted-foreground">
                            Recommendation: <strong className="text-foreground">{r.recommendation.replace(/_/g, " ")}</strong>
                          </p>
                          <p className="text-muted-foreground">Overall score: {r.overallScore}/5 · Confidence: {r.confidence}/5</p>
                          {r.commentsToEditor && (
                            <p className="mt-1 italic text-foreground/80">
                              “{r.commentsToEditor}”
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reviewer pool */}
              {openAssigner && (
                <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-medium">Suggested reviewers (ranked by keyword match)</p>
                  <div className="space-y-1.5">
                    {reviewers.slice(0, 6).map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded border border-border bg-card p-2 text-xs">
                        <div>
                          <p className="font-medium">{r.fullName}</p>
                          <p className="text-[0.65rem] text-muted-foreground">
                            {r.affiliation} · Expertise: {r.expertise || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.matchScore > 0 && (
                            <Badge variant="outline" className="font-mono text-[0.55rem]">
                              match {r.matchScore}
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            disabled={assigningReviewer === r.id}
                            onClick={() => assignReviewer(r.id)}
                          >
                            {assigningReviewer === r.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Users className="mr-1 h-3 w-3" /> Invite
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* AI Editorial Triage */}
            <TriagePanel articleId={article.id} />

            <Separator />

            {/* Open peer review toggle + Production actions */}
            <div className="space-y-3">
              {/* Open peer review */}
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  {article.openReview ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="font-display text-sm font-semibold">Open peer review</p>
                    <p className="text-xs text-muted-foreground">
                      {article.openReview
                        ? "Completed reviews are public on the article page."
                        : "Reviews are visible only to the editorial team."}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={article.openReview ? "default" : "outline"}
                  disabled={togglingOpenReview}
                  onClick={async () => {
                    setTogglingOpenReview(true);
                    try {
                      await apiFetch("/api/articles/open-review", {
                        method: "POST",
                        body: JSON.stringify({ articleId: article.id, openReview: !article.openReview }),
                      });
                      toast.success(article.openReview ? "Open review disabled" : "Open review enabled");
                      onRefresh();
                      onClose();
                    } catch (e: any) {
                      toast.error(e.message);
                    } finally {
                      setTogglingOpenReview(false);
                    }
                  }}
                >
                  {togglingOpenReview && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {article.openReview ? "Disable" : "Enable"}
                </Button>
              </div>

              {/* Production: Crossref deposit + Galley generation (for accepted/published articles) */}
              {(article.status === "ACCEPTED" || article.status === "IN_PRODUCTION" || article.status === "PUBLISHED") && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={depositingCrossref}
                    onClick={async () => {
                      setDepositingCrossref(true);
                      try {
                        await apiFetch("/api/crossref/deposit", {
                          method: "POST",
                          body: JSON.stringify({ articleId: article.id }),
                        });
                        toast.success("Crossref deposit submitted");
                        onRefresh();
                        onClose();
                      } catch (e: any) {
                        toast.error(e.message);
                      } finally {
                        setDepositingCrossref(false);
                      }
                    }}
                  >
                    {depositingCrossref ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Globe2 className="mr-1 h-3 w-3" />}
                    Deposit to Crossref
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generatingGalley}
                    onClick={async () => {
                      setGeneratingGalley(true);
                      try {
                        await apiFetch("/api/galley/generate", {
                          method: "POST",
                          body: JSON.stringify({ articleId: article.id }),
                        });
                        toast.success("Galleys generated (HTML + PDF + JATS)");
                        onRefresh();
                        onClose();
                      } catch (e: any) {
                        toast.error(e.message);
                      } finally {
                        setGeneratingGalley(false);
                      }
                    }}
                  >
                    {generatingGalley ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileDown className="mr-1 h-3 w-3" />}
                    Generate galleys
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Workflow actions */}
            <div>
              <p className="eyebrow mb-2">Workflow actions</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACTIONS.map((a) => {
                  // Hide actions that don't make sense for current status
                  if (article.status === "SUBMITTED" && !["SEND_TO_REVIEW", "REJECT"].includes(a.key)) return null;
                  if (article.status === "UNDER_REVIEW" && !["REQUEST_REVISIONS", "ACCEPT", "REJECT"].includes(a.key)) return null;
                  if (article.status === "REVISIONS_REQUIRED" && !["ACCEPT", "REJECT"].includes(a.key)) return null;
                  if (article.status === "ACCEPTED" && a.key !== "SEND_TO_PRODUCTION") return null;
                  if (article.status === "IN_PRODUCTION" && a.key !== "PUBLISH") return null;
                  if (article.status === "PUBLISHED" || article.status === "REJECTED" || article.status === "WITHDRAWN") return null;
                  return (
                    <Button
                      key={a.key}
                      variant={action === a.key ? "default" : "outline"}
                      size="sm"
                      className="justify-start"
                      onClick={() => setAction(a.key)}
                    >
                      <a.icon className="mr-1.5 h-3.5 w-3.5" /> {a.label}
                    </Button>
                  );
                })}
              </div>

              {action && (
                <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <Label className="text-xs">Editorial note (optional)</Label>
                  <Textarea
                    rows={2}
                    className="mt-1.5"
                    placeholder="Add an editorial note that will be logged in the audit trail…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setAction(null); setNote(""); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={applyAction} disabled={loading}>
                      {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      Confirm {ACTIONS.find(a => a.key === action)?.label.toLowerCase()}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-4">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="mt-1.5 font-display text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-muted/20 px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
