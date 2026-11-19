"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, Inbox, Loader2, XCircle, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { DECIDED_FORMS, OFFICIAL_FORMS, FORM_ROLE_LABEL, formPath } from "@/lib/forms";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormRecordItem, type FormRecordRow } from "@/components/forms/article-forms-panel";

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"];

/**
 * Dashboard → Official forms: every form the user has signed (with its
 * signed PDF), the catalogue of forms for their role, and, for editors, the
 * authorship-change requests and appeals waiting for a decision.
 */
export function OfficialFormsTab() {
  const { user } = useApp();
  const isEditor = !!user && EDITOR_ROLES.includes(user.role);
  const [mine, setMine] = useState<FormRecordRow[] | null>(null);
  const [inbox, setInbox] = useState<FormRecordRow[] | null>(null);

  const load = useCallback(() => {
    apiFetch<{ records: FormRecordRow[] }>("/api/forms/records")
      .then((r) => setMine(r.records))
      .catch(() => setMine([]));
    if (isEditor) {
      apiFetch<{ records: FormRecordRow[] }>("/api/forms/records?inbox=1")
        .then((r) => setInbox(r.records))
        .catch(() => setInbox([]));
    }
  }, [isEditor]);
  useEffect(load, [load]);

  const pending = (inbox ?? []).filter((r) => r.status === "PENDING");
  const decided = (inbox ?? []).filter((r) => r.status !== "PENDING");
  const roleKey = isEditor ? "editor" : user?.role === "REVIEWER" ? "reviewer" : "author";

  return (
    <div className="space-y-5">
      <Card className="paper-card overflow-hidden">
        <div className="bg-gradient-to-br from-[#2a1458] to-[var(--royal-600,#4c1d95)] px-6 py-5 text-white">
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.18em] text-[#e2c785]">Research compliance</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Official forms</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/80">
            The declarations you have signed on the platform, each with a signed PDF copy. Forms are asked for automatically
            at the right step: at submission, when you accept a review, and before an editorial decision.
          </p>
        </div>
        <CardContent className="p-5">
          <p className="eyebrow mb-2">Forms for {FORM_ROLE_LABEL[roleKey].toLowerCase()}</p>
          <div className="flex flex-wrap gap-2">
            {OFFICIAL_FORMS.filter((f) => f.role === roleKey).map((f) => (
              <a key={f.id} href={formPath(f)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:border-primary/50 hover:text-primary">
                <span className="font-semibold">{f.code}</span> {f.title}
              </a>
            ))}
          </div>
          <p className="eyebrow mb-2 mt-4">Complaints, concerns and requests</p>
          <div className="flex flex-wrap gap-2">
            {OFFICIAL_FORMS.filter((f) => f.role === "public").map((f) => (
              <a key={f.id} href={`${formPath(f)}#submit`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:border-primary/50 hover:text-primary">
                <span className="font-semibold">{f.code}</span> {f.title}
              </a>
            ))}
            <a href="/resources?tab=forms" className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:underline">
              All forms <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {isEditor && (
        <Card className="paper-card">
          <CardContent className="p-5">
            <p className="flex items-center gap-2 font-display text-lg font-semibold">
              <Inbox className="h-5 w-5 text-primary" /> Requests to decide
              {pending.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{pending.length}</span>}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Authorship changes (EP-F-06), appeals (EP-F-11), withdrawals (EP-F-17), complaints (EP-F-23), concerns about
              articles (EP-F-24), correction requests (EP-F-25){user && ["SUPER_ADMIN", "TENANT_ADMIN"].includes(user.role) ? " and data privacy requests (EP-F-26)" : ""}. An appeal
              is decided by an editor not involved in the original decision, and a complaint by someone other than the person it
              names. Your explanation is sent to the sender.
            </p>
            {inbox === null ? (
              <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
            ) : pending.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nothing waiting for a decision.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pending.map((r) => (
                  <PendingRequest key={r.id} r={r} onDecided={load} />
                ))}
              </ul>
            )}
            {decided.length > 0 && (
              <details className="mt-5">
                <summary className="cursor-pointer text-xs font-semibold text-primary">Decided requests ({decided.length})</summary>
                <ul className="mt-3 space-y-2.5">
                  {decided.map((r) => (
                    <FormRecordItem key={r.id} r={r} showArticle />
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="paper-card">
        <CardContent className="p-5">
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <FileSignature className="h-5 w-5 text-primary" /> Forms you have signed
          </p>
          {mine === null ? (
            <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
          ) : mine.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">You haven't signed any forms yet. They're asked for at the step that needs them.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {mine.map((r) => (
                <FormRecordItem key={r.id} r={r} showArticle />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingRequest({ r, onDecided }: { r: FormRecordRow; onDecided: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"APPROVE" | "DECLINE" | null>(null);
  const labels = DECIDED_FORMS[r.formId] ?? { approve: "Approve", decline: "Decline", approved: "Approved", declined: "Declined" };

  async function decide(decision: "APPROVE" | "DECLINE") {
    if (note.trim().length < 10) {
      toast.error("Explain your decision", { description: "At least a sentence; it is sent to the sender." });
      return;
    }
    setBusy(decision);
    try {
      await apiFetch(`/api/forms/records/${r.id}/decide`, { method: "POST", body: JSON.stringify({ decision, note }) });
      toast.success(decision === "APPROVE" ? labels.approved : labels.declined, { description: "The sender has been told the outcome." });
      onDecided();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="space-y-3 rounded-lg border border-amber-300/70 p-3">
      <ul>
        <FormRecordItem r={r} showArticle />
      </ul>
      <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Your decision and the reasons for it (sent to the sender)…" />
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => decide("DECLINE")}>
          {busy === "DECLINE" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1.5 h-3.5 w-3.5" />}
          {labels.decline}
        </Button>
        <Button size="sm" disabled={!!busy} onClick={() => decide("APPROVE")}>
          {busy === "APPROVE" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
          {labels.approve}
        </Button>
      </div>
    </li>
  );
}
