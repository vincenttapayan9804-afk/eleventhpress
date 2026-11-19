"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BadgePercent, ClipboardCheck, ShieldAlert } from "lucide-react";
import { formById } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { OfficialFormDialog } from "./required-forms-dialog";

type EditorRecord = "form-desk-screening" | "form-waiver-assessment" | "form-integrity-record";

const WAIVER_LABEL: Record<string, string> = {
  REQUESTED: "Waiver requested: not yet assessed",
  APPROVED: "Waiver approved",
  DENIED: "Waiver not granted",
};

/**
 * Editorial queue → a manuscript → Forms: the records an editor completes
 * on it. These are the Initial Editorial Screening Checklist (EP-F-20), the
 * APC Waiver Assessment Record (EP-F-21) when the authors asked for a
 * waiver, and the Research Integrity Investigation Record (EP-F-22).
 */
export function EditorArticleForms({
  article,
  onSigned,
}: {
  article: { id: string; title: string; apcWaiverRequested?: boolean; apcWaiverStatus?: string; apcWaiverReason?: string | null };
  onSigned: () => void;
}) {
  const [dialog, setDialog] = useState<EditorRecord | null>(null);
  const doc = dialog ? formById(dialog) : undefined;
  const waiver = article.apcWaiverRequested || (article.apcWaiverStatus && article.apcWaiverStatus !== "NONE");

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-[0.66rem] font-bold uppercase tracking-wider text-muted-foreground">Editor records</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setDialog("form-desk-screening")}>
          <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Screening checklist
        </Button>
        {waiver && (
          <Button size="sm" variant="outline" onClick={() => setDialog("form-waiver-assessment")}>
            <BadgePercent className="mr-1.5 h-3.5 w-3.5" /> Assess APC waiver
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setDialog("form-integrity-record")}>
          <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Integrity record
        </Button>
      </div>
      {waiver && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{WAIVER_LABEL[article.apcWaiverStatus ?? "REQUESTED"] ?? "Waiver requested"}.</span>
          {article.apcWaiverReason ? ` Author's reason: “${article.apcWaiverReason}”` : ""}
        </p>
      )}
      {doc && (
        <OfficialFormDialog
          open
          forms={[{ formId: doc.id, code: doc.code, title: doc.title, articleId: article.id }]}
          intro={`For “${article.title}”. ${doc.summary}`}
          onCancel={() => setDialog(null)}
          onDone={(outcomes) => {
            setDialog(null);
            const o = outcomes[0]?.outcome;
            toast.success(`${doc.code} recorded`, {
              description:
                o === "WAIVER_APPROVED" ? "The waiver is approved and the author has been told." : o === "WAIVER_DENIED" ? "The author has been told the decision and the reasons." : o === "REVIEW" ? "The manuscript can now be sent to peer review." : "Kept with the manuscript, visible to editors only.",
            });
            onSigned();
          }}
        />
      )}
    </div>
  );
}
