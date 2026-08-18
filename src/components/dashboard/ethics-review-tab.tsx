"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Check, X, Clock } from "lucide-react";

interface EthicsSubmission {
  id: string;
  tenantId: string;
  submissionType: string;
  title: string;
  description: string | null;
  status: string;
  protocolNumber: string | null;
  reviewNote: string | null;
  submittedAt: string;
  submittedBy: { id: string; fullName: string; email: string };
  reviewedBy: { id: string; fullName: string; email: string } | null;
  department: { id: string; name: string; slug: string } | null;
  article: { id: string; title: string } | null;
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
 * EP University OS Phase 3 — the tenant's review queue for IRB protocols
 * and COI disclosures. Visible to TENANT_SCOPED_ADMIN_ROLES only (no
 * ETHICS_REVIEWER role yet — see roles.ts). Mirrors DepartmentsTab's
 * list-with-inline-actions shape.
 */
export function EthicsReviewTab() {
  const [submissions, setSubmissions] = useState<EthicsSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ submissions: EthicsSubmission[] }>("/api/admin/ethics-submissions");
      setSubmissions(res.submissions);
    } catch (e: any) {
      toast.error(e.message || "Failed to load ethics submissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(s: EthicsSubmission, status: "UNDER_REVIEW" | "APPROVED" | "REJECTED") {
    setActingId(s.id);
    try {
      await apiFetch(`/api/admin/ethics-submissions/${s.id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, reviewNote: notes[s.id]?.trim() || undefined }),
      });
      toast.success(`Submission ${status === "APPROVED" ? "approved" : status === "REJECTED" ? "rejected" : "marked under review"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update submission");
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pending = submissions.filter((s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW");
  const decided = submissions.filter((s) => s.status === "APPROVED" || s.status === "REJECTED" || s.status === "EXPIRED");

  return (
    <div className="space-y-5">
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="eyebrow">
              {pending.length} pending review{pending.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing waiting on review.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((s) => (
                <div key={s.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold">{s.title}</h3>
                    <Badge variant="outline" className="text-[0.6rem]">
                      {TYPE_LABEL[s.submissionType] || s.submissionType}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[s.status] || "outline"} className="text-[0.6rem]">
                      {s.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Filed by {s.submittedBy.fullName} ({s.submittedBy.email})
                    {s.department ? ` · ${s.department.name}` : ""}
                    {s.article ? ` · re: ${s.article.title}` : ""}
                  </p>
                  {s.description && <p className="mt-1 text-xs text-foreground/80">{s.description}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Review note (optional)"
                      className="h-8 max-w-xs text-xs"
                      value={notes[s.id] || ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    />
                    <Button size="sm" className="h-8" disabled={actingId === s.id} onClick={() => decide(s, "APPROVED")}>
                      {actingId === s.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" disabled={actingId === s.id} onClick={() => decide(s, "REJECTED")}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Reject
                    </Button>
                    {s.status === "SUBMITTED" && (
                      <Button size="sm" variant="ghost" className="h-8" disabled={actingId === s.id} onClick={() => decide(s, "UNDER_REVIEW")}>
                        <Clock className="mr-1 h-3.5 w-3.5" />
                        Mark under review
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-3">
          <p className="eyebrow">
            {decided.length} decided submission{decided.length === 1 ? "" : "s"}
          </p>
        </CardHeader>
        <CardContent>
          {decided.length === 0 ? (
            <p className="text-xs text-muted-foreground">No decisions yet.</p>
          ) : (
            <div className="space-y-3">
              {decided.map((s) => (
                <div key={s.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold">{s.title}</h3>
                    <Badge variant="outline" className="text-[0.6rem]">
                      {TYPE_LABEL[s.submissionType] || s.submissionType}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[s.status] || "outline"} className="text-[0.6rem]">
                      {s.status.replace("_", " ")}
                    </Badge>
                    {s.protocolNumber && (
                      <Badge variant="outline" className="text-[0.6rem]">
                        {s.protocolNumber}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Filed by {s.submittedBy.fullName}
                    {s.reviewedBy ? ` · reviewed by ${s.reviewedBy.fullName}` : ""}
                  </p>
                  {s.reviewNote && <p className="mt-1 text-xs text-foreground/80">Note: {s.reviewNote}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
