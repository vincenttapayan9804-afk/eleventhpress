"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileCheck2, FileSignature, Gavel, LogOut, Users } from "lucide-react";
import { formById } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { ArticleFormsPanel } from "./article-forms-panel";
import { OfficialFormDialog } from "./required-forms-dialog";

const CLOSED = ["PUBLISHED", "RETRACTED", "WITHDRAWN", "REJECTED"];

/**
 * My Articles → one manuscript's Official Forms: the signed declarations
 * (with PDFs) and the author's requests: an Authorship Change Request
 * (EP-F-06) before publication, an Appeal (EP-F-11) after a rejection,
 * Proof Approval (EP-F-16) in production, and a Withdrawal Request (EP-F-17).
 */
type AuthorRequest = "form-authorship-change" | "form-appeal" | "form-proof-approval" | "form-withdrawal";
const DONE_TOAST: Record<AuthorRequest, [string, string]> = {
  "form-authorship-change": ["Sent to the editor", "You'll be notified of the decision. A signed copy is under Official forms."],
  "form-appeal": ["Appeal sent", "An editor not involved in the decision will consider it. A signed copy is under Official forms."],
  "form-proof-approval": ["Proof sign-off sent", "The production editor has been notified. A signed copy is under Official forms."],
  "form-withdrawal": ["Withdrawal requested", "The editor will confirm. Don't submit elsewhere until they do."],
};
export function ArticleOfficialForms({ article, onChanged }: { article: { id: string; title: string; status: string; authors?: string }; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<AuthorRequest | null>(null);
  const [key, setKey] = useState(0);
  const doc = dialog ? formById(dialog) : undefined;

  let currentAuthors: { name: string; email: string; affiliation?: string; orcid?: string }[] = [];
  try {
    currentAuthors = (JSON.parse(article.authors || "[]") as any[]).map((a) => ({ name: a.name ?? "", email: a.email ?? "", affiliation: a.affiliation ?? "", orcid: a.orcid ?? "" }));
  } catch {}

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <FileSignature className="h-3.5 w-3.5" /> Official forms
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <div className="flex flex-wrap gap-2">
          {!CLOSED.includes(article.status) && (
            <Button size="sm" variant="outline" onClick={() => setDialog("form-authorship-change")}>
              <Users className="mr-1.5 h-3.5 w-3.5" /> Request authorship change
            </Button>
          )}
          {["ACCEPTED", "IN_PRODUCTION"].includes(article.status) && (
            <Button size="sm" variant="outline" onClick={() => setDialog("form-proof-approval")}>
              <FileCheck2 className="mr-1.5 h-3.5 w-3.5" /> Approve proof
            </Button>
          )}
          {!CLOSED.includes(article.status) && article.status !== "DRAFT" && (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDialog("form-withdrawal")}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Request withdrawal
            </Button>
          )}
          {article.status === "REJECTED" && (
            <Button size="sm" variant="outline" onClick={() => setDialog("form-appeal")}>
              <Gavel className="mr-1.5 h-3.5 w-3.5" /> Appeal this decision
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3">
          <ArticleFormsPanel articleId={article.id} refreshKey={key} />
        </div>
      )}
      {doc && (
        <OfficialFormDialog
          open
          forms={[{ formId: doc.id, code: doc.code, title: doc.title, articleId: article.id }]}
          intro={`For “${article.title}”. ${doc.summary}`}
          initialAnswers={doc.id === "form-authorship-change" ? { proposedAuthors: currentAuthors } : undefined}
          onCancel={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setOpen(true);
            setKey((k) => k + 1);
            const [title, description] = DONE_TOAST[doc.id as AuthorRequest] ?? DONE_TOAST["form-authorship-change"];
            toast.success(title, { description });
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
