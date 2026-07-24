"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DISCIPLINE_COLORS,
  parseAuthors,
} from "@/lib/article";
import type { ArticleStatus } from "@/lib/article";
import { TriagePanel } from "@/components/dashboard/triage-panel";
import { ManuscriptChecksPanel } from "@/components/dashboard/manuscript-checks-panel";
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
  Database,
  Trash2,
  ExternalLink,
  Plus,
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
        {["ALL", "SUBMITTED", "UNDER_REVIEW", "REVISIONS_REQUIRED", "ACCEPTED", "IN_PRODUCTION", "PUBLISHED"].map((s) => (
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

const DELETE_ACTION = "DELETE_ARTICLE";

function ArticleDialog({ article, onClose, onRefresh }: { article: any | null; onClose: () => void; onRefresh: () => void }) {
  const user = useApp((s) => s.user);
  const [action, setAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [assigningReviewer, setAssigningReviewer] = useState<string | null>(null);
  const [openAssigner, setOpenAssigner] = useState(false);
  const [togglingOpenReview, setTogglingOpenReview] = useState(false);
  const [depositingCrossref, setDepositingCrossref] = useState(false);
  const [depositingZenodo, setDepositingZenodo] = useState(false);
  const [generatingGalley, setGeneratingGalley] = useState(false);
  const [togglingReviewHistory, setTogglingReviewHistory] = useState(false);
  const [lastDecisionId, setLastDecisionId] = useState<string | null>(null);
  const [letterBody, setLetterBody] = useState("");
  const [savingLetter, setSavingLetter] = useState(false);
  const [draftingLetter, setDraftingLetter] = useState(false);
  const [mintingReportDoi, setMintingReportDoi] = useState(false);
  const [curatedReviews, setCuratedReviews] = useState<any[]>([]);
  const [curatedChannelOptions, setCuratedChannelOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingCurated, setLoadingCurated] = useState(false);
  const [curatedLoaded, setCuratedLoaded] = useState(false);
  const [newCuratedChannel, setNewCuratedChannel] = useState("");
  const [newCuratedUrl, setNewCuratedUrl] = useState("");
  const [newCuratedReviewer, setNewCuratedReviewer] = useState("");
  const [newCuratedExcerpt, setNewCuratedExcerpt] = useState("");
  const [newCuratedRecommendation, setNewCuratedRecommendation] = useState("");
  const [savingCurated, setSavingCurated] = useState(false);
  const [deletingCuratedId, setDeletingCuratedId] = useState<string | null>(null);

  if (!article) return null;

  async function loadCurated() {
    setLoadingCurated(true);
    try {
      const res = await apiFetch<{ reviews: any[]; curatedChannels: { value: string; label: string }[] }>(
        `/api/articles/${article.id}/independent-reviews`
      );
      setCuratedReviews(res.reviews);
      setCuratedChannelOptions(res.curatedChannels);
      setCuratedLoaded(true);
    } catch (e: any) {
      toast.error("Failed to load community reviews", { description: e.message });
    } finally {
      setLoadingCurated(false);
    }
  }

  async function addCuratedReview() {
    if (!newCuratedChannel || !newCuratedUrl.trim()) return;
    setSavingCurated(true);
    try {
      await apiFetch(`/api/articles/${article.id}/independent-reviews`, {
        method: "POST",
        body: JSON.stringify({
          channel: newCuratedChannel,
          externalUrl: newCuratedUrl.trim(),
          reviewerName: newCuratedReviewer.trim() || undefined,
          excerpt: newCuratedExcerpt.trim() || undefined,
          recommendation: newCuratedRecommendation.trim() || undefined,
        }),
      });
      toast.success("Curated review link added");
      setNewCuratedChannel("");
      setNewCuratedUrl("");
      setNewCuratedReviewer("");
      setNewCuratedExcerpt("");
      setNewCuratedRecommendation("");
      await loadCurated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingCurated(false);
    }
  }

  async function deleteCuratedReview(reviewId: string) {
    setDeletingCuratedId(reviewId);
    try {
      await apiFetch(`/api/articles/${article.id}/independent-reviews`, {
        method: "DELETE",
        body: JSON.stringify({ reviewId }),
      });
      toast.success("Curated review link removed");
      await loadCurated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingCuratedId(null);
    }
  }

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

  async function deleteArticle() {
    setDeleting(true);
    try {
      await apiFetch(`/api/articles/${article.id}`, { method: "DELETE" });
      toast.success("Article permanently deleted");
      setAction(null);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function applyAction() {
    if (!action) return;
    if (action === DELETE_ACTION) {
      await deleteArticle();
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ decisionId: string }>("/api/articles/workflow", {
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
      // Stays open (instead of the previous onClose()) so the editor can
      // immediately compose a public decision letter for the decision
      // that was just logged — lastDecisionId is what the letter
      // composer below attaches to.
      setLastDecisionId(res.decisionId);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function draftLetter() {
    if (!lastDecisionId) return;
    setDraftingLetter(true);
    try {
      const res = await apiFetch<{ letterBody: string; mode: string }>(
        `/api/articles/${article.id}/decision-letter/draft`,
        { method: "POST", body: JSON.stringify({ decisionId: lastDecisionId }) }
      );
      if (res.mode === "llm" && res.letterBody) {
        setLetterBody(res.letterBody);
        toast.success("Draft ready — review and edit before publishing.");
      } else {
        toast.error("AI draft unavailable", { description: "No LLM configured for this deployment." });
      }
    } catch (e: any) {
      toast.error("AI draft failed", { description: e.message });
    } finally {
      setDraftingLetter(false);
    }
  }

  const visibleActions = ACTIONS.filter((a) => {
    if (article.status === "SUBMITTED") return ["SEND_TO_REVIEW", "REJECT"].includes(a.key);
    if (article.status === "UNDER_REVIEW") return ["REQUEST_REVISIONS", "ACCEPT", "REJECT"].includes(a.key);
    if (article.status === "REVISIONS_REQUIRED") return ["ACCEPT", "REJECT"].includes(a.key);
    if (article.status === "ACCEPTED") return a.key === "SEND_TO_PRODUCTION";
    if (article.status === "IN_PRODUCTION") return a.key === "PUBLISH";
    return false; // PUBLISHED, REJECTED, WITHDRAWN — no further transitions
  });

  return (
    <Dialog open={!!article} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words font-display text-lg">
            Editorial control · {article.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="workflow" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="flex w-full flex-shrink-0 items-center gap-1 overflow-x-auto [&>*]:shrink-0">
            <TabsTrigger value="workflow">
              Workflow{visibleActions.length > 0 ? ` (${visibleActions.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reviewers">
              Reviewers{article.reviews.length > 0 ? ` (${article.reviews.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="community" onClick={() => !curatedLoaded && loadCurated()}>
              Community
            </TabsTrigger>
            <TabsTrigger value="checks">AI &amp; checks</TabsTrigger>
          </TabsList>

          {/* Workflow — first tab, so the actions editors need most are
              reachable in one click instead of buried at the bottom of a
              long scroll behind reviewers/triage/checks content. */}
          <TabsContent value="workflow" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-[48vh] pr-3 epip-scroll">
              <div className="space-y-4">
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

                {/* Review History transparency — independent of Open peer
                    review above; anonymized reviewer numbering, no
                    reviewer identity ever shown. */}
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    {article.anonymizedReviewHistory ? <Globe2 className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="font-display text-sm font-semibold">Review History (anonymized)</p>
                      <p className="text-xs text-muted-foreground">
                        {article.anonymizedReviewHistory
                          ? "Anonymized reviews, author responses, and published decision letters are public."
                          : "Reviewer numbering, author responses, and decision letters stay internal."}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={article.anonymizedReviewHistory ? "default" : "outline"}
                    disabled={togglingReviewHistory}
                    onClick={async () => {
                      setTogglingReviewHistory(true);
                      try {
                        await apiFetch(`/api/articles/${article.id}/review-history`, {
                          method: "POST",
                          body: JSON.stringify({ anonymizedReviewHistory: !article.anonymizedReviewHistory }),
                        });
                        toast.success(article.anonymizedReviewHistory ? "Review History disabled" : "Review History enabled");
                        onRefresh();
                      } catch (e: any) {
                        toast.error(e.message);
                      } finally {
                        setTogglingReviewHistory(false);
                      }
                    }}
                  >
                    {togglingReviewHistory && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {article.anonymizedReviewHistory ? "Disable" : "Enable"}
                  </Button>
                </div>

                {/* Decision letter composer — attaches to the decision
                    just logged by the workflow action above, so this only
                    appears right after applyAction() returns one. */}
                {lastDecisionId && (
                  <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p className="font-display text-sm font-semibold">
                      Public decision letter <span className="font-normal text-muted-foreground">(optional)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Attaches to the decision you just logged. Separate from the internal note above — only appears
                      on the article&apos;s Review History tab once published, and only if Review History is enabled.
                    </p>
                    <Textarea
                      value={letterBody}
                      onChange={(e) => setLetterBody(e.target.value)}
                      placeholder="Dear author, thank you for your submission…"
                      rows={4}
                      className="text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={draftLetter} disabled={draftingLetter}>
                        {draftingLetter && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        AI draft
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setLastDecisionId(null); setLetterBody(""); }}>
                        Skip
                      </Button>
                      <Button
                        size="sm"
                        disabled={savingLetter || !letterBody.trim()}
                        onClick={async () => {
                          setSavingLetter(true);
                          try {
                            await apiFetch(`/api/articles/${article.id}/decision-letter`, {
                              method: "POST",
                              body: JSON.stringify({ decisionId: lastDecisionId, letterBody, publish: true }),
                            });
                            toast.success("Decision letter published");
                            setLastDecisionId(null);
                            setLetterBody("");
                          } catch (e: any) {
                            toast.error(e.message);
                          } finally {
                            setSavingLetter(false);
                          }
                        }}
                      >
                        {savingLetter && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Publish letter
                      </Button>
                    </div>
                  </div>
                )}

                {/* Review report DOI — only meaningful once published and
                    Review History is enabled. */}
                {article.status === "PUBLISHED" && article.anonymizedReviewHistory && (
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <p className="font-display text-sm font-semibold">Review report DOI</p>
                      <p className="text-xs text-muted-foreground">
                        {article.reviewReportDoi
                          ? `Deposited: ${article.reviewReportDoi}`
                          : "Not yet minted — needs at least one completed review."}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mintingReportDoi}
                      onClick={async () => {
                        setMintingReportDoi(true);
                        try {
                          const result = await apiFetch<{ ok: boolean; message: string; doi: string | null }>(
                            `/api/articles/${article.id}/review-report-doi`,
                            { method: "POST" }
                          );
                          if (result.ok) {
                            toast.success(result.message);
                            onRefresh();
                          } else {
                            toast.error(result.message);
                          }
                        } catch (e: any) {
                          toast.error(e.message);
                        } finally {
                          setMintingReportDoi(false);
                        }
                      }}
                    >
                      {mintingReportDoi && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {article.reviewReportDoi ? "Re-deposit" : "Mint DOI"}
                    </Button>
                  </div>
                )}

                {/* Production: Zenodo/Crossref deposit + Galley generation (for accepted/published articles) */}
                {(article.status === "ACCEPTED" || article.status === "IN_PRODUCTION" || article.status === "PUBLISHED") && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={depositingZenodo}
                      onClick={async () => {
                        setDepositingZenodo(true);
                        try {
                          const result = await apiFetch<{ ok: boolean; message: string; doi: string | null }>(
                            "/api/zenodo/deposit",
                            { method: "POST", body: JSON.stringify({ articleId: article.id }) }
                          );
                          if (result.ok) {
                            toast.success("Zenodo deposit succeeded", { description: result.message });
                          } else {
                            toast.error("Zenodo deposit failed", { description: result.message });
                          }
                          onRefresh();
                          onClose();
                        } catch (e: any) {
                          toast.error(e.message);
                        } finally {
                          setDepositingZenodo(false);
                        }
                      }}
                    >
                      {depositingZenodo ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Database className="mr-1 h-3 w-3" />}
                      Deposit to Zenodo
                    </Button>
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
                          const res = await apiFetch<{ deduped?: boolean }>("/api/galley/generate", {
                            method: "POST",
                            body: JSON.stringify({ articleId: article.id }),
                          });
                          toast.success(
                            res.deduped
                              ? "Galley generation already in progress for this article"
                              : "Galleys generated (HTML + PDF + JATS)"
                          );
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

                <Separator />

                {/* Workflow actions */}
                <div>
                  <p className="eyebrow mb-2">Workflow actions</p>
                  {visibleActions.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                      No further transitions — this article is {STATUS_LABELS[article.status as ArticleStatus].toLowerCase()}.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {visibleActions.map((a) => (
                        <Button
                          key={a.key}
                          variant={action === a.key ? "default" : "outline"}
                          size="sm"
                          className="justify-start"
                          onClick={() => setAction(a.key)}
                        >
                          <a.icon className="mr-1.5 h-3.5 w-3.5" /> {a.label}
                        </Button>
                      ))}
                    </div>
                  )}
                  {action && action !== DELETE_ACTION && (
                    <p className="mt-2 text-[0.7rem] text-muted-foreground">
                      Selected: <strong>{ACTIONS.find((a) => a.key === action)?.label}</strong> — add an
                      optional note and confirm below.
                    </p>
                  )}
                </div>

                {/* SUPER_ADMIN only — permanently removes the row and every
                    related record, unlike REJECT/WITHDRAWN above which just
                    change status and keep the record. */}
                {user?.role === "SUPER_ADMIN" && (
                  <>
                    <Separator />
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                      <p className="eyebrow mb-1 text-destructive">Danger zone</p>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Permanently deletes this article and every related record (reviews, decisions,
                        corrections, references, DOI/Zenodo/Crossref history, galleys, files). This
                        cannot be undone.
                      </p>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setAction(DELETE_ACTION)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete permanently
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Overview */}
          <TabsContent value="overview" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-[48vh] pr-3 epip-scroll">
              <div className="space-y-4">
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
                  <MetaRow label="DOI" value={<code className="break-all font-mono">{article.doi || "—"}</code>} />
                  <MetaRow label="Review model" value={article.reviewModel.replace("_", " ")} />
                  <MetaRow label="Similarity score" value={`${article.plagiarismScore ?? "—"}% (in-corpus)`} />
                  <MetaRow label="Submitted" value={article.submittedAt ? new Date(article.submittedAt).toLocaleString() : "—"} />
                </div>

                <Separator />

                <div>
                  <p className="eyebrow mb-1">Abstract</p>
                  <p className="text-xs leading-relaxed text-foreground/80">{article.abstract}</p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Reviewers */}
          <TabsContent value="reviewers" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-[48vh] pr-3 epip-scroll">
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
            </ScrollArea>
          </TabsContent>

          {/* Community and Independent Review — editor-curated links for
              channels with no automated feed (PCI, Sciety, SciPost,
              OpenReview). Automated rows (Hypothes.is, PREreview) show here
              too, read-only, so editors can see the full picture the public
              Review History tab will show. */}
          <TabsContent value="community" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-[48vh] pr-3 epip-scroll">
              <div className="space-y-4">
                <div>
                  <p className="eyebrow mb-1">Community and Independent Review</p>
                  <p className="text-xs text-muted-foreground">
                    Hypothes.is and PREreview are checked automatically. PCI, Sciety, SciPost, and
                    OpenReview have no automated feed yet — paste a link only after you&apos;ve
                    actually read the review at that URL yourself.
                  </p>
                </div>

                {loadingCurated ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <>
                    {curatedReviews.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        No independent reviews recorded yet for this article.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {curatedReviews.map((r) => (
                          <div key={r.id} className="rounded-md border border-border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline" className="text-[0.6rem]">{r.channelLabel}</Badge>
                                  <Badge variant="outline" className="text-[0.6rem]">
                                    {r.sourceType === "EDITOR_ENTERED" ? "Curated" : "Automated"}
                                  </Badge>
                                  {r.recommendation && (
                                    <Badge variant="outline" className="text-[0.6rem]">{r.recommendation}</Badge>
                                  )}
                                </div>
                                <a
                                  href={r.externalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 flex items-center gap-1 truncate text-xs text-primary hover:underline"
                                >
                                  {r.externalUrl} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                                {r.excerpt && (
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.excerpt}</p>
                                )}
                              </div>
                              {r.sourceType === "EDITOR_ENTERED" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 flex-shrink-0 p-0 text-destructive hover:text-destructive"
                                  disabled={deletingCuratedId === r.id}
                                  onClick={() => deleteCuratedReview(r.id)}
                                >
                                  {deletingCuratedId === r.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="font-display text-sm font-semibold">Add a curated link</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Select value={newCuratedChannel} onValueChange={setNewCuratedChannel}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {curatedChannelOptions.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={newCuratedUrl}
                          onChange={(e) => setNewCuratedUrl(e.target.value)}
                          placeholder="https://…"
                          className="h-9 text-xs"
                        />
                        <Input
                          value={newCuratedReviewer}
                          onChange={(e) => setNewCuratedReviewer(e.target.value)}
                          placeholder="Reviewer name (optional)"
                          className="h-9 text-xs"
                        />
                        <Input
                          value={newCuratedRecommendation}
                          onChange={(e) => setNewCuratedRecommendation(e.target.value)}
                          placeholder="Recommendation (optional)"
                          className="h-9 text-xs"
                        />
                      </div>
                      <Textarea
                        value={newCuratedExcerpt}
                        onChange={(e) => setNewCuratedExcerpt(e.target.value)}
                        placeholder="Short excerpt or summary (optional)"
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={savingCurated || !newCuratedChannel || !newCuratedUrl.trim()}
                          onClick={addCuratedReview}
                        >
                          {savingCurated ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="mr-1 h-3 w-3" />
                          )}
                          Add link
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* AI Editorial Triage + Manuscript checks */}
          <TabsContent value="checks" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-[48vh] pr-3 epip-scroll">
              <div className="space-y-4">
                <TriagePanel articleId={article.id} />
                <ManuscriptChecksPanel articleId={article.id} />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Confirm bar — deliberately outside the tabs/scrollable area so
            it's always visible once an action is selected, regardless of
            which tab is active or scroll position (previously buried at
            the bottom of one long scroll, which made the confirm click
            easy to miss). */}
        {action && action !== DELETE_ACTION && (
          <div className="flex-shrink-0 border-t border-border bg-primary/5 p-3">
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

        {action === DELETE_ACTION && (
          <div className="flex-shrink-0 border-t border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive">
              This is permanent. "{article.title}" and every related record will be deleted — there is
              no undo.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={applyAction} disabled={deleting}>
                {deleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                Confirm delete permanently
              </Button>
            </div>
          </div>
        )}
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
