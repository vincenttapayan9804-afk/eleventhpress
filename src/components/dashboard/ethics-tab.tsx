"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Plus, ScrollText } from "lucide-react";

interface EthicsSubmission {
  id: string;
  submissionType: string;
  title: string;
  description: string | null;
  status: string;
  protocolNumber: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  expiresAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  IRB_PROTOCOL: "IRB protocol",
  COI_DISCLOSURE: "COI disclosure",
};

const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  SUBMITTED: "outline",
  UNDER_REVIEW: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  EXPIRED: "destructive",
};

/**
 * EP University OS Phase 3 — self-service ethics/compliance filing: a
 * researcher files an IRB protocol, a reviewer files a conflict-of-interest
 * disclosure, either way tracked here and reviewed by the tenant's admin
 * (see EthicsReviewTab). Mirrors DepartmentsTab's create-form + list shape.
 */
export function EthicsTab() {
  const [submissions, setSubmissions] = useState<EthicsSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionType, setSubmissionType] = useState<"IRB_PROTOCOL" | "COI_DISCLOSURE">("IRB_PROTOCOL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ submissions: EthicsSubmission[] }>("/api/ethics-submissions");
      setSubmissions(res.submissions);
    } catch (e: any) {
      toast.error(e.message || "Failed to load your ethics submissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/ethics-submissions", {
        method: "POST",
        body: JSON.stringify({ submissionType, title: title.trim(), description: description.trim() || undefined }),
      });
      toast.success("Submission filed");
      setTitle("");
      setDescription("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to file submission");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="eyebrow">File an IRB protocol or COI disclosure</p>
          </div>
          <p className="text-xs text-muted-foreground">
            An IRB protocol covers human/animal-subjects research approval. A conflict-of-interest disclosure
            declares a financial or personal interest that could bias your authorship or review. Either goes to your
            institution's admin for review.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ethicsType">Type</Label>
              <select
                id="ethicsType"
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value as "IRB_PROTOCOL" | "COI_DISCLOSURE")}
              >
                <option value="IRB_PROTOCOL">IRB protocol</option>
                <option value="COI_DISCLOSURE">COI disclosure</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ethicsTitle">Title</Label>
              <Input
                id="ethicsTitle"
                placeholder={submissionType === "IRB_PROTOCOL" ? "Study title" : "Nature of the interest"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ethicsDescription">Description (optional)</Label>
            <Textarea
              id="ethicsDescription"
              rows={3}
              placeholder="Additional detail for the reviewer"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            File submission
          </Button>
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            <p className="eyebrow">
              {submissions.length} submission{submissions.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">You haven't filed any ethics submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => (
                <div key={s.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold">{s.title}</h3>
                        <Badge variant="outline" className="text-[0.6rem]">
                          {TYPE_LABEL[s.submissionType] || s.submissionType}
                        </Badge>
                        <Badge variant={STATUS_VARIANT[s.status] || "outline"} className="text-[0.6rem]">
                          {s.status.replace("_", " ")}
                        </Badge>
                      </div>
                      {s.protocolNumber && <p className="text-xs text-muted-foreground">Protocol #{s.protocolNumber}</p>}
                      {s.description && <p className="mt-1 text-xs text-foreground/80">{s.description}</p>}
                      {s.reviewNote && <p className="mt-1 text-xs text-muted-foreground">Reviewer note: {s.reviewNote}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
