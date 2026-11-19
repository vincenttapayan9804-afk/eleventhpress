"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileSignature, Gavel, Users } from "lucide-react";
import { formById } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { ArticleFormsPanel } from "./article-forms-panel";
import { OfficialFormDialog } from "./required-forms-dialog";

const CLOSED = ["PUBLISHED", "RETRACTED", "WITHDRAWN", "REJECTED"];

/**
 * My Articles → one manuscript's Official Forms: the signed declarations
 * (with PDFs) and the author's requests: an Authorship Change Request
 * (EP-F-06) before publication, and an Appeal (EP-F-11) after a rejection.
 */
export function ArticleOfficialForms({ article, onChanged }: { article: { id: string; title: string; status: string; authors?: string }; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"form-authorship-change" | "form-appeal" | null>(null);
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
            toast.success("Sent to the editor", { description: "You'll be notified of the decision. A signed copy is under Official forms." });
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
