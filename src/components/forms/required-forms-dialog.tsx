"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { FileDown, FileSignature, Loader2, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formById, formPath, formPdfPath } from "@/lib/forms";
import { validateFormAnswers } from "@/lib/forms/validate";
import type { FormAnswers } from "@/lib/forms/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OfficialFormFields, FormSignature } from "./official-form-fields";

export interface RequiredFormRef {
  formId: string;
  code: string;
  title: string;
  articleId?: string;
  reviewId?: string;
}

export interface FormOutcome {
  formId: string;
  outcome: string;
  recordId: string;
}

/**
 * A dialog that walks the signer through one or more Official Forms in
 * turn (e.g. EP-F-10 then EP-F-09 before an editor's first decision) and
 * posts each to /api/forms/[formId].
 */
export function OfficialFormDialog({
  forms,
  open,
  onDone,
  onCancel,
  intro,
  initialAnswers,
}: {
  forms: RequiredFormRef[];
  open: boolean;
  onDone: (outcomes: FormOutcome[]) => void;
  onCancel: () => void;
  intro?: string;
  /** Pre-filled answers for the first form (e.g. the current author list). */
  initialAnswers?: FormAnswers;
}) {
  const [step, setStep] = useState(0);
  // Seeded once: a caller with pre-filled answers mounts the dialog fresh each time it opens.
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers ?? {});
  const [signedName, setSignedName] = useState("");
  const [saving, setSaving] = useState(false);
  const outcomes = useRef<FormOutcome[]>([]);
  const current = forms[step];
  const doc = current ? formById(current.formId) : undefined;

  const reset = () => {
    setStep(0);
    setAnswers({});
    setSignedName("");
    outcomes.current = [];
  };

  async function submit() {
    if (!current || !doc) return;
    const check = validateFormAnswers(doc, answers, signedName);
    if (!check.ok) {
      toast.error("Please complete the form", { description: check.error });
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ record: { id: string }; outcome: string }>(`/api/forms/${current.formId}`, {
        method: "POST",
        body: JSON.stringify({ answers: check.answers, signedName: check.signedName, articleId: current.articleId, reviewId: current.reviewId }),
      });
      outcomes.current.push({ formId: current.formId, outcome: res.outcome, recordId: res.record.id });
      toast.success(`${doc.code} signed`, { description: doc.title });
      if (step + 1 < forms.length) {
        setStep(step + 1);
        setAnswers({});
      } else {
        const done = outcomes.current;
        reset();
        onDone(done);
      }
    } catch (e: any) {
      toast.error(`Could not sign ${doc.code}`, { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onCancel();
        }
      }}
    >
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto p-0">
        {doc && (
          <>
            <div className="bg-gradient-to-br from-[#2a1458] to-[var(--royal-600,#4c1d95)] px-6 pb-5 pt-6 text-white">
              <DialogHeader className="space-y-2 text-left">
                <p className="inline-flex w-fit rounded border border-[#c9a55c]/70 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-[#e2c785]">
                  Official form · {doc.code}
                  {forms.length > 1 ? ` · ${step + 1} of ${forms.length}` : ""}
                </p>
                <DialogTitle className="font-display text-2xl font-semibold text-white">{doc.title}</DialogTitle>
                <DialogDescription className="text-sm text-white/80">{intro && step === 0 ? intro : doc.summary}</DialogDescription>
              </DialogHeader>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <a href={formPath(doc)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#e2c785] hover:underline">
                  <ShieldCheck className="h-3.5 w-3.5" /> About this form
                </a>
                <a href={formPdfPath(doc)} className="inline-flex items-center gap-1 text-[#e2c785] hover:underline">
                  <FileDown className="h-3.5 w-3.5" /> Fillable PDF
                </a>
              </div>
            </div>
            <div className="space-y-6 px-6 py-6">
              <OfficialFormFields doc={doc} answers={answers} onChange={setAnswers} />
              <FormSignature doc={doc} value={signedName} onChange={setSignedName} />
            </div>
            <DialogFooter className="sticky bottom-0 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  onCancel();
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileSignature className="mr-1.5 h-4 w-4" />}
                Sign {doc.code}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Wraps an API call that the server may hold back with HTTP 428 and a
 * `requiredForms` list (see src/lib/forms/server.ts). When that happens the
 * dialog asks for the forms, then the call is retried once.
 *
 *   const gate = useRequiredFormsGate();
 *   await gate.run(() => apiFetch(...));
 *   return <>{gate.dialog}…</>;
 */
export function useRequiredFormsGate(intro?: string) {
  const [pending, setPending] = useState<{ forms: RequiredFormRef[]; resolve: (o: FormOutcome[] | null) => void } | null>(null);

  const ask = useCallback((forms: RequiredFormRef[]) => new Promise<FormOutcome[] | null>((resolve) => setPending({ forms, resolve })), []);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, onOutcomes?: (o: FormOutcome[]) => boolean | void): Promise<T | null> => {
      try {
        return await fn();
      } catch (e: any) {
        const required: RequiredFormRef[] | undefined = e?.body?.requiredForms;
        if (e?.status !== 428 || !required?.length) throw e;
        const outcomes = await ask(required);
        if (!outcomes) return null;
        // A caller can stop the retry (e.g. a declared conflict of interest).
        if (onOutcomes?.(outcomes) === false) return null;
        return await fn();
      }
    },
    [ask]
  );

  const dialog = (
    <OfficialFormDialog
      forms={pending?.forms ?? []}
      open={!!pending}
      intro={intro}
      onDone={(o) => {
        pending?.resolve(o);
        setPending(null);
      }}
      onCancel={() => {
        pending?.resolve(null);
        setPending(null);
      }}
    />
  );

  return { run, ask, dialog };
}
