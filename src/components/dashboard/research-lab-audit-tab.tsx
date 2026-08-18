"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, FlaskConical, Users } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  user: { id: string; fullName: string; email: string } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ActivityData {
  documentsByKind: { kind: string; count: number }[];
  transcriptionsByStatus: { status: string; count: number }[];
  editedDocumentCount: number;
  activeShareCount: number;
  topContributors: { user: { id: string; fullName: string; email: string } | null; documentCount: number }[];
  recentActivity: ActivityEntry[];
}

const ACTION_LABEL: Record<string, string> = {
  RESEARCH_LAB_DOCUMENT_CREATED: "created a document",
  RESEARCH_LAB_DOCUMENT_EDITED: "edited a document",
  RESEARCH_LAB_DOCUMENT_SHARED: "shared a document",
  TRANSCRIPTION_GENERATED: "transcribed a recording",
};

const KIND_LABEL: Record<string, string> = { GAP_ANALYSIS: "Gap analyses", PRISMA_DRAFT: "Systematic review drafts" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Tier 3 institutional-governance dashboard for the Eleventh Research Lab
 * — every number here is a live count against ResearchLabDocument/
 * TranscriptionJob/AuditLog (see /api/admin/research-lab-activity), never
 * an estimate. Editorial staff use this to see how the tool is actually
 * being used platform-wide, not to police individual researchers' drafts
 * (which stay owner/share-scoped everywhere else in the tool).
 */
export function ResearchLabAuditTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ActivityData>("/api/admin/research-lab-activity")
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load"));
  }, []);

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  if (!data) {
    return <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Research Lab Activity</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Real, aggregated usage of the Eleventh Research Lab across every researcher — every figure below is a live count, not an estimate.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="paper-card">
          <CardContent className="p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FlaskConical className="h-3 w-3" /> Saved documents</p>
            <div className="mt-1 space-y-0.5">
              {data.documentsByKind.length === 0 ? (
                <p className="text-lg font-semibold">0</p>
              ) : (
                data.documentsByKind.map((d) => (
                  <p key={d.kind} className="text-sm">
                    <span className="font-semibold">{d.count}</span> <span className="text-muted-foreground">{KIND_LABEL[d.kind] || d.kind}</span>
                  </p>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="paper-card">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Edited after generation</p>
            <p className="mt-1 text-lg font-semibold">{data.editedDocumentCount}</p>
          </CardContent>
        </Card>
        <Card className="paper-card">
          <CardContent className="p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3 w-3" /> Active shares</p>
            <p className="mt-1 text-lg font-semibold">{data.activeShareCount}</p>
          </CardContent>
        </Card>
      </div>

      {data.transcriptionsByStatus.length > 0 && (
        <Card className="paper-card">
          <CardHeader className="pb-2"><p className="text-xs font-medium">Transcription jobs</p></CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            {data.transcriptionsByStatus.map((s) => (
              <Badge key={s.status} variant="outline" className="text-[0.65rem]">{s.count} {s.status.toLowerCase()}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {data.topContributors.length > 0 && (
        <Card className="paper-card">
          <CardHeader className="pb-2"><p className="text-xs font-medium">Most active researchers</p></CardHeader>
          <CardContent className="space-y-1 pt-0">
            {data.topContributors.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span>{c.user ? `${c.user.fullName} (${c.user.email})` : "Unknown user"}</span>
                <span className="text-muted-foreground">{c.documentCount} document(s)</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="paper-card">
        <CardHeader className="pb-2"><p className="text-xs font-medium">Recent activity</p></CardHeader>
        <CardContent className="space-y-1.5 pt-0">
          {data.recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity yet.</p>
          ) : (
            data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 border-b border-border/60 pb-1.5 text-xs last:border-0">
                <span>
                  <span className="font-medium">{a.user ? a.user.fullName : "Unknown user"}</span>{" "}
                  <span className="text-muted-foreground">{ACTION_LABEL[a.action] || a.action}</span>
                </span>
                <span className="shrink-0 text-[0.65rem] text-muted-foreground">{formatDate(a.createdAt)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
