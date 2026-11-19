"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, FileDown, FileSignature, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formById, SUBMISSION_FORM_IDS } from "@/lib/forms";
import { Badge } from "@/components/ui/badge";
import { OfficialFormFields } from "./official-form-fields";

export interface FormRecordRow {
  id: string;
  formId: string;
  code: string;
  title: string;
  version: string;
  status: string;
  statusLabel: string;
  signedName: string;
  signedAt: string;
  signer: string;
  article: { id: string; title: string; status: string } | null;
  decisionNote: string | null;
  decidedAt: string | null;
  answers: Record<string, unknown>;
  pdfUrl: string;
}

export const STATUS_TONE: Record<string, string> = {
  SUBMITTED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  PENDING: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  DECLINED: "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

/** One signed record: code, title, signer, status, the answers on demand and the signed PDF. */
export function FormRecordItem({ r, showArticle }: { r: FormRecordRow; showArticle?: boolean }) {
  const [open, setOpen] = useState(false);
  const doc = formById(r.formId);
  return (
    <li className="rounded-lg border border-border">
      <div className="flex flex-wrap items-start justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-bold uppercase tracking-wider text-muted-foreground">
            {r.code} · v{r.version}
          </p>
          <p className="font-display text-sm font-semibold">{r.title}</p>
          {showArticle && r.article && <p className="mt-0.5 truncate text-xs text-muted-foreground">“{r.article.title}”</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            Signed by {r.signedName} · {new Date(r.signedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {r.decisionNote && <p className="mt-1.5 rounded bg-muted/50 px-2 py-1 text-xs">Editor: {r.decisionNote}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={`border text-[0.62rem] ${STATUS_TONE[r.status] ?? ""}`}>
            {r.statusLabel}
          </Badge>
          <a href={r.pdfUrl} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <FileDown className="h-3.5 w-3.5" /> PDF
          </a>
          {doc && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              Answers <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      {open && doc && (
        <div className="border-t border-border bg-muted/20 p-4 [&_input]:opacity-100 [&_textarea]:opacity-100">
          <OfficialFormFields
            doc={doc}
            answers={r.answers as any}
            mode="view"
            compact
            authors={(r.answers.authors as { name: string }[] | undefined)?.map((a) => ({ name: a.name }))}
          />
        </div>
      )}
    </li>
  );
}

/**
 * The Official Forms signed for one manuscript: the submission
 * declarations, requests, and (for editors) reviewer and editor declarations.
 */
export function ArticleFormsPanel({ articleId, refreshKey = 0 }: { articleId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<FormRecordRow[] | null>(null);
  const load = useCallback(() => {
    apiFetch<{ records: FormRecordRow[] }>(`/api/forms/records?articleId=${encodeURIComponent(articleId)}`)
      .then((r) => setRows(r.records))
      .catch(() => setRows([]));
  }, [articleId]);
  useEffect(load, [load, refreshKey]);

  if (!rows) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading signed forms…
      </div>
    );
  }
  const missing = SUBMISSION_FORM_IDS.filter((id) => !rows.some((r) => r.formId === id));
  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <FileSignature className="mr-1 inline h-3.5 w-3.5" />
          Submitted before the Official Forms were introduced, or not yet signed: {missing.map((id) => formById(id)?.code).join(", ")}.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No signed forms for this manuscript yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <FormRecordItem key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
