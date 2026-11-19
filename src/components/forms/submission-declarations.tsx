"use client";

import { CheckCircle2, Circle, FileDown, ShieldCheck } from "lucide-react";
import { formById, formPath, formPdfPath, SUBMISSION_FORM_IDS } from "@/lib/forms";
import { validateFormAnswers } from "@/lib/forms/validate";
import type { FormAnswers, OfficialFormDoc } from "@/lib/forms/types";
import { OfficialFormFields } from "./official-form-fields";
import { Input } from "@/components/ui/input";

export type Declarations = Record<string, FormAnswers>;

const DOCS = SUBMISSION_FORM_IDS.map((id) => formById(id)!) as OfficialFormDoc[];

/** The first problem with the five submission declarations, or null when all are complete. */
export function declarationsError(decl: Declarations, signedName: string, authors: { name: string; email?: string }[]): string | null {
  for (const doc of DOCS) {
    const v = validateFormAnswers(doc, decl[doc.id], signedName || "x".repeat(3), { authors });
    if (!v.ok) return `${doc.code} ${doc.title}: ${v.error}`;
  }
  if (signedName.trim().length < 3) return "Sign the declarations by typing your full name.";
  return null;
}

function isComplete(doc: OfficialFormDoc, answers: FormAnswers | undefined, authors: { name: string }[]) {
  return validateFormAnswers(doc, answers, "xxx", { authors }).ok;
}

/**
 * Step 4 of the submission form: the five Official Forms every manuscript
 * needs (EP-F-01 to EP-F-05), one after another with a progress list, and
 * a single signature that signs all five.
 */
export function SubmissionDeclarations({
  value,
  onChange,
  active,
  onActive,
  signedName,
  onSignedName,
  authors,
}: {
  value: Declarations;
  onChange: (next: Declarations) => void;
  active: number;
  onActive: (i: number) => void;
  signedName: string;
  onSignedName: (v: string) => void;
  authors: { name: string; email?: string }[];
}) {
  const doc = DOCS[active] ?? DOCS[0];
  const done = DOCS.map((d) => isComplete(d, value[d.id], authors));
  const completed = done.filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-display font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Official declarations ({completed} of {DOCS.length} complete)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Every manuscript needs these five Official Forms, benchmarked against COPE, ICMJE and the other standards in our
          guides. Complete each one, then sign once at the bottom. Signed copies are kept with your manuscript.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Declarations">
          {DOCS.map((d, i) => (
            <li key={d.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onActive(i)}
                aria-current={i === active ? "step" : undefined}
                className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  i === active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                {done[i] ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0">
                  <span className="block text-[0.62rem] font-bold uppercase tracking-wider text-muted-foreground">{d.code}</span>
                  <span className="block font-medium leading-snug">{d.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="min-w-0 rounded-lg border border-border">
          <div className="border-b border-[var(--gold-500)]/60 bg-[var(--royal-50)]/60 px-5 py-4 dark:bg-white/[0.03]">
            <p className="text-[0.66rem] font-bold uppercase tracking-wider text-[var(--gold-600,#8a6a28)]">
              Official form · {doc.code} · {active + 1} of {DOCS.length}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-semibold">{doc.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{doc.summary}</p>
            <div className="mt-2 flex gap-4 text-xs">
              <a href={formPath(doc)} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                About this form
              </a>
              <a href={formPdfPath(doc)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <FileDown className="h-3 w-3" /> Fillable PDF
              </a>
            </div>
          </div>
          <div className="p-5">
            <OfficialFormFields doc={doc} answers={value[doc.id] ?? {}} onChange={(a) => onChange({ ...value, [doc.id]: a })} authors={authors} />
            <div className="mt-6 flex justify-between">
              <button type="button" disabled={active === 0} onClick={() => onActive(active - 1)} className="text-xs font-medium text-primary disabled:opacity-40">
                ← Previous form
              </button>
              {active < DOCS.length - 1 && (
                <button type="button" onClick={() => onActive(active + 1)} className="text-xs font-semibold text-primary">
                  Next form →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-[var(--royal-50)]/50 p-5 dark:bg-white/[0.03]">
        <p className="font-display text-base font-semibold text-primary">Sign the declarations</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/85">
          By typing your name you sign {DOCS.map((d) => d.code).join(", ")} on behalf of all authors, and declare that the
          information in them is true and complete. A false declaration may lead to rejection or retraction, following COPE
          guidance.
        </p>
        <div className="mt-3 max-w-md">
          <label htmlFor="decl-sign" className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
            Your full name
          </label>
          <Input id="decl-sign" value={signedName} onChange={(e) => onSignedName(e.target.value)} placeholder="Full name" className="mt-1 font-display text-lg italic" autoComplete="name" />
        </div>
      </section>
    </div>
  );
}
