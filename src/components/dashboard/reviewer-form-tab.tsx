"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  PenSquare,
  Send,
  XCircle,
  ShieldAlert,
  FileText,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react";

interface Props {
  reviewId: string;
  onRefresh: () => void;
}

const RECOMMENDATIONS = [
  { value: "ACCEPT", label: "Accept (no revisions needed)" },
  { value: "MINOR_REVISIONS", label: "Minor revisions" },
  { value: "MAJOR_REVISIONS", label: "Major revisions" },
  { value: "REJECT", label: "Reject" },
];

export function ReviewerFormTab({ reviewId, onRefresh }: Props) {
  const { openDashboard } = useApp();
  const [review, setReview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [aiCheck, setAiCheck] = useState<{ suggestions: string[]; mode: string } | null>(null);
  const [checkingAi, setCheckingAi] = useState(false);

  const [form, setForm] = useState({
    overallScore: 4,
    recommendation: "MINOR_REVISIONS",
    confidence: 4,
    commentsToAuthor: "",
    commentsToEditor: "",
    conflictOfInterest: false,
  });

  useEffect(() => {
    apiFetch<{ reviews: any[] }>("/api/reviews?scope=mine")
      .then(({ reviews }) => {
        const r = reviews.find((x) => x.id === reviewId);
        if (!r) {
          toast.error("Review not found");
          openDashboard("reviewerQueue");
          return;
        }
        setReview(r);
        if (r.status === "COMPLETED") {
          setForm({
            overallScore: r.overallScore || 4,
            recommendation: r.recommendation || "MINOR_REVISIONS",
            confidence: r.confidence || 4,
            commentsToAuthor: r.commentsToAuthor || "",
            commentsToEditor: r.commentsToEditor || "",
            conflictOfInterest: r.conflictOfInterest || false,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [reviewId, openDashboard]);

  async function submit(status: "ACCEPTED" | "DECLINED" | "IN_PROGRESS" | "COMPLETED") {
    setSubmitting(status);
    try {
      await apiFetch("/api/reviews/submit", {
        method: "POST",
        body: JSON.stringify({
          reviewId,
          status,
          ...(status === "COMPLETED" ? form : {}),
        }),
      });
      toast.success(
        status === "COMPLETED" ? "Review submitted" : status === "DECLINED" ? "Invitation declined" : "Review saved as in-progress",
        {
          description:
            status === "COMPLETED"
              ? "The editor has been notified of your recommendation."
              : status === "DECLINED"
              ? "The editor will reassign this review."
              : "You can return to this review later to complete it.",
        }
      );
      onRefresh();
      openDashboard("reviewerQueue");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(null);
    }
  }

  async function runAiCheck() {
    setCheckingAi(true);
    setAiCheck(null);
    try {
      const result = await apiFetch<{ suggestions: string[]; mode: string }>(
        `/api/reviews/${reviewId}/completeness-check`,
        {
          method: "POST",
          body: JSON.stringify({
            commentsToAuthor: form.commentsToAuthor,
            recommendation: form.recommendation,
          }),
        }
      );
      setAiCheck(result);
    } catch (e: any) {
      toast.error(e.message || "AI check failed");
    } finally {
      setCheckingAi(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!review) return null;

  const article = review.article;
  const isDoubleBlind = article?.reviewModel === "DOUBLE_BLIND";
  const isCompleted = review.status === "COMPLETED";

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => openDashboard("reviewerQueue")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to my reviews
      </Button>

      <Card className="paper-card">
        <CardHeader>
          <p className="eyebrow">
            {isDoubleBlind ? "Double-blind peer review" : article?.reviewModel.replace(/_/g, " ") + " peer review"}
          </p>
          <h2 className="font-display text-2xl font-semibold leading-tight">
            {article?.title}
          </h2>
          {isDoubleBlind && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50 p-3 text-xs text-violet-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Double-blind review in effect</p>
                <p>
                  Author names, affiliations, and acknowledgements have been stripped from
                  the manuscript you are about to read. Please do not attempt to identify
                  the authors. The anonymised PDF is served from the
                  <code className="mx-1 rounded bg-violet-100 px-1 font-mono">anonymized-manuscripts</code>
                  bucket via a short-lived pre-signed URL.
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Manuscript preview */}
          <div>
            <p className="eyebrow mb-2">Manuscript preview</p>
            <div className="rounded-md border border-border bg-muted/20 p-4">
              <p className="font-display text-sm font-semibold">{article?.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {article?.discipline} · Submitted {article?.submittedAt ? new Date(article.submittedAt).toLocaleDateString() : "—"}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-foreground/80 line-clamp-6">
                {article?.abstract}
              </p>
              <Button size="sm" variant="outline" className="mt-3" disabled>
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Open anonymised PDF
              </Button>
            </div>
          </div>

          <Separator />

          {/* Review form */}
          {isCompleted && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              This review has been submitted. You can still edit and resubmit below.
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Overall assessment (1 = poor, 5 = excellent)</Label>
            <RadioGroup
              value={String(form.overallScore)}
              onValueChange={(v) => setForm({ ...form, overallScore: parseInt(v, 10) })}
              className="flex gap-3"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex items-center gap-1.5">
                  <RadioGroupItem value={String(n)} id={`score-${n}`} />
                  <Label htmlFor={`score-${n}`} className="cursor-pointer text-sm">{n}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>Recommendation</Label>
            <Select value={form.recommendation} onValueChange={(v) => setForm({ ...form, recommendation: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECOMMENDATIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Reviewer confidence (1 = low, 5 = expert)</Label>
            <RadioGroup
              value={String(form.confidence)}
              onValueChange={(v) => setForm({ ...form, confidence: parseInt(v, 10) })}
              className="flex gap-3"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex items-center gap-1.5">
                  <RadioGroupItem value={String(n)} id={`conf-${n}`} />
                  <Label htmlFor={`conf-${n}`} className="cursor-pointer text-sm">{n}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-author">Comments to the author</Label>
            <Textarea
              id="c-author"
              rows={6}
              placeholder="Detailed feedback for the author. Be specific about strengths, weaknesses, and required revisions. This text will be shared with the author verbatim."
              value={form.commentsToAuthor}
              onChange={(e) => setForm({ ...form, commentsToAuthor: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={runAiCheck}
              disabled={checkingAi || !form.commentsToAuthor.trim()}
            >
              {checkingAi ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              AI check — anything missing?
            </Button>
            {aiCheck && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {aiCheck.suggestions.length > 0
                      ? "A few things you might consider adding — entirely optional:"
                      : "Looks reasonably complete."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAiCheck(null)}
                    aria-label="Dismiss suggestions"
                    className="flex-shrink-0 text-amber-700 hover:text-amber-900"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {aiCheck.suggestions.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4">
                    {aiCheck.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[0.65rem] text-amber-700/80">
                  AI-generated suggestion — purely advisory and never affects your review or blocks submission.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-editor">Confidential comments to the editor</Label>
            <Textarea
              id="c-editor"
              rows={4}
              placeholder="Optional. Not shared with the author. Use this to flag concerns about scope, ethics, or suitability that the editor should weigh privately."
              value={form.commentsToEditor}
              onChange={(e) => setForm({ ...form, commentsToEditor: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border p-3">
            <input
              type="checkbox"
              id="coi"
              className="h-4 w-4 rounded border-border"
              checked={form.conflictOfInterest}
              onChange={(e) => setForm({ ...form, conflictOfInterest: e.target.checked })}
            />
            <Label htmlFor="coi" className="cursor-pointer text-sm">
              I have a conflict of interest with this submission (co-authorship, financial interest, personal relationship).
            </Label>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!isCompleted && (
              <Button
                variant="outline"
                onClick={() => submit("IN_PROGRESS")}
                disabled={submitting !== null}
              >
                {submitting === "IN_PROGRESS" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <PenSquare className="mr-1.5 h-3.5 w-3.5" /> Save as in-progress
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => submit("DECLINED")}
              disabled={submitting !== null}
            >
              {submitting === "DECLINED" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Decline invitation
            </Button>
            <Button
              onClick={() => submit("COMPLETED")}
              disabled={submitting !== null || !form.commentsToAuthor}
              className="ml-auto"
            >
              {submitting === "COMPLETED" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              <Send className="mr-1.5 h-3.5 w-3.5" /> Submit review
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
