"use client";

import { Fragment, useId } from "react";
import { Plus, X, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isFieldShown } from "@/lib/forms/validate";
import type { FormAnswers, FormField, ListedAuthorAnswer, OfficialFormDoc } from "@/lib/forms/types";

/**
 * Renders an Official Form (src/lib/forms) in the house style of the guides:
 * numbered parts with a gold rule, tick boxes in the royal purple, notices
 * in a tinted panel with a gold edge.
 *
 * - mode "fill": interactive; conditional questions appear as they apply.
 * - mode "preview": read-only, every question shown with when it applies
 *   (the public form page).
 */
export interface OfficialFormFieldsProps {
  doc: OfficialFormDoc;
  answers: FormAnswers;
  onChange?: (next: FormAnswers) => void;
  /** "view": a signed record's answers, read-only, only the questions that applied. */
  mode?: "fill" | "preview" | "view";
  /** Authors on the manuscript, for sections completed once per author. */
  authors?: { name: string; email?: string }[];
  /** Hide the per-part headings (e.g. when the caller already shows the form title). */
  compact?: boolean;
}

function conditionText(f: FormField, all: FormField[]): string | null {
  if (!f.showIf) return null;
  const parent = all.find((x) => x.id === f.showIf!.field);
  if (!parent) return null;
  const labels = (parent.options ?? []).filter((o) => f.showIf!.in.includes(o.value)).map((o) => `“${o.label.replace(/[,:].*$/, "")}”`);
  return `Answer only if you chose ${labels.join(" or ")} above.`;
}

export function OfficialFormFields({ doc, answers, onChange, mode = "fill", authors, compact }: OfficialFormFieldsProps) {
  const preview = mode === "preview";
  const readOnly = mode !== "fill";
  const all = doc.sections.flatMap((s) => s.fields);
  const set = (patch: Record<string, unknown>) => onChange?.({ ...answers, ...patch });

  return (
    <div className="space-y-8">
      {doc.sections.map((s, si) => {
        if (s.repeat === "authors") {
          const list = preview ? [{ name: "Author 1" }, { name: "Author 2" }] : authors ?? [];
          const rows = (answers.authors as Record<string, unknown>[] | undefined) ?? [];
          return (
            <section key={s.heading} aria-labelledby={`${doc.id}-p${si}`}>
              {!compact && <PartHeading id={`${doc.id}-p${si}`} n={si + 1} title={s.heading} />}
              {s.intro && <p className="mb-3 text-sm text-muted-foreground">{s.intro}</p>}
              <div className="space-y-4">
                {list.map((a, ai) => {
                  const row = rows[ai] ?? {};
                  const setRow = (patch: Record<string, unknown>) => {
                    const next = list.map((x, i) => ({ name: x.name, ...(rows[i] ?? {}), ...(i === ai ? patch : {}) }));
                    set({ authors: next });
                  };
                  return (
                    <div key={ai} className="rounded-lg border border-border">
                      <p className="border-l-[3px] border-[var(--gold-500)] bg-[var(--royal-50)]/70 px-4 py-2 text-[0.7rem] font-bold uppercase tracking-wider text-primary dark:bg-white/[0.04]">
                        Author {ai + 1}
                        {a.name && !preview ? ` · ${a.name}` : ""}
                      </p>
                      <div className="space-y-5 p-4">
                        {s.fields.filter((f) => preview || isFieldShown(f, row)).map((f) => (
                          <FieldRow key={f.id} f={f} scope={row} all={s.fields} preview={preview} readOnly={readOnly} onSet={setRow} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!preview && list.length === 0 && <p className="text-sm text-destructive">Add the manuscript's authors first.</p>}
              </div>
            </section>
          );
        }
        const shown = s.fields.filter((f) => preview || isFieldShown(f, answers));
        if (!shown.length) return null;
        return (
          <section key={s.heading} aria-labelledby={`${doc.id}-p${si}`}>
            {!compact && <PartHeading id={`${doc.id}-p${si}`} n={si + 1} title={s.heading} />}
            {s.intro && <p className="mb-3 text-sm text-muted-foreground">{s.intro}</p>}
            <div className="space-y-5">
              {shown.map((f) => (
                <FieldRow key={f.id} f={f} scope={answers} all={all} preview={preview} readOnly={readOnly} onSet={set} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PartHeading({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <h3 id={id} className="mb-4 flex items-baseline gap-3 border-b border-[var(--gold-500)]/70 pb-2">
      <span className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[var(--gold-600,#8a6a28)]">Part {n}</span>
      <span className="font-display text-lg font-semibold text-primary">{title}</span>
    </h3>
  );
}

function FieldRow({
  f,
  scope,
  all,
  preview,
  readOnly,
  onSet,
}: {
  f: FormField;
  scope: Record<string, unknown>;
  all: FormField[];
  preview: boolean;
  readOnly: boolean;
  onSet: (patch: Record<string, unknown>) => void;
}) {
  const uid = useId();
  const v = scope[f.id];
  const cond = preview ? conditionText(f, all) : null;
  const condNote = cond ? <p className="mb-1 text-xs italic text-[var(--gold-600,#8a6a28)]">{cond}</p> : null;

  if (f.type === "notice") {
    const m = /^(\d+\.\s[^.]+\.)\s*([\s\S]*)$/.exec(f.label);
    return (
      <p className="border-l-[3px] border-[var(--gold-500)] bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground/85">
        {m ? (
          <>
            <strong className="text-foreground">{m[1]}</strong> {m[2]}
          </>
        ) : (
          f.label
        )}
      </p>
    );
  }

  if (f.type === "attest") {
    return (
      <div>
        {condNote}
        <label className={`flex gap-3 rounded-md p-1.5 text-[0.95rem] leading-relaxed ${readOnly ? "" : "cursor-pointer hover:bg-muted/40"}`}>
          <input
            type="checkbox"
            disabled={readOnly}
            checked={v === true}
            onChange={(e) => onSet({ [f.id]: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--royal-600)]"
          />
          <span className="min-w-0">{f.label}</span>
        </label>
      </div>
    );
  }

  const labelEl = (
    <div className="mb-2">
      {condNote}
      <label htmlFor={uid} className="block text-sm font-semibold text-foreground">
        {f.label}
        {f.required && <span className="ml-1 text-primary" aria-hidden>*</span>}
      </label>
      {f.help && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.help}</p>}
    </div>
  );

  if (f.type === "radio" || f.type === "checkboxes") {
    const selected = Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [];
    return (
      <fieldset>
        <legend className="sr-only">{f.label}</legend>
        {labelEl}
        <div className="space-y-1">
          {(f.options ?? []).map((o) => {
            const on = selected.includes(o.value);
            return (
              <label key={o.value} className={`flex gap-3 rounded-md px-1.5 py-1 text-sm leading-relaxed ${readOnly ? "" : "cursor-pointer hover:bg-muted/40"} ${on ? "font-medium text-foreground" : "text-foreground/85"}`}>
                <input
                  type={f.type === "radio" ? "radio" : "checkbox"}
                  name={uid}
                  disabled={readOnly}
                  checked={on}
                  onChange={(e) => {
                    if (f.type === "radio") onSet({ [f.id]: o.value });
                    else {
                      let next = e.target.checked ? [...selected, o.value] : selected.filter((x) => x !== o.value);
                      // "None of these" excludes every other choice, and vice versa.
                      if (e.target.checked && o.value === "none") next = ["none"];
                      else if (e.target.checked) next = next.filter((x) => x !== "none");
                      onSet({ [f.id]: next });
                    }
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--royal-600)]"
                />
                <span className="min-w-0">{o.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (f.type === "authorList") {
    const list = (Array.isArray(v) ? v : []) as ListedAuthorAnswer[];
    const rows = preview ? [{ name: "", email: "" }] : list.length ? list : [{ name: "", email: "" }];
    const update = (i: number, patch: Partial<ListedAuthorAnswer>) => onSet({ [f.id]: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
    return (
      <div>
        {labelEl}
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-border p-2.5 sm:grid-cols-[1.5rem_1fr_1fr_1fr_0.8fr_auto] sm:items-center">
              <span className="text-xs font-bold text-[var(--gold-600,#8a6a28)]">{i + 1}</span>
              <Input aria-label={`Author ${i + 1} full name`} placeholder="Full name" disabled={readOnly} value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input aria-label={`Author ${i + 1} email`} placeholder="Email" type="email" disabled={readOnly} value={r.email} onChange={(e) => update(i, { email: e.target.value })} />
              <Input aria-label={`Author ${i + 1} affiliation`} placeholder="Affiliation" disabled={readOnly} value={r.affiliation ?? ""} onChange={(e) => update(i, { affiliation: e.target.value })} />
              <Input aria-label={`Author ${i + 1} ORCID iD`} placeholder="ORCID iD" disabled={readOnly} value={r.orcid ?? ""} onChange={(e) => update(i, { orcid: e.target.value })} />
              {!readOnly && (
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove author ${i + 1}`} onClick={() => onSet({ [f.id]: rows.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" onClick={() => onSet({ [f.id]: [...rows, { name: "", email: "" }] })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add author
            </Button>
          )}
        </div>
      </div>
    );
  }

  const s = typeof v === "string" ? v : "";
  return (
    <div>
      {labelEl}
      {f.type === "textarea" ? (
        <Textarea id={uid} rows={4} disabled={readOnly} placeholder={f.placeholder} value={s} maxLength={f.maxLength ?? 4000} onChange={(e) => onSet({ [f.id]: e.target.value })} />
      ) : (
        <Input id={uid} type={f.type === "date" ? "date" : f.type === "email" ? "email" : "text"} disabled={readOnly} placeholder={f.placeholder} value={s} onChange={(e) => onSet({ [f.id]: e.target.value })} />
      )}
    </div>
  );
}

/** The signature block that ends every form: the declaration, a typed full name and today's date. */
export function FormSignature({ doc, value, onChange, preview }: { doc: OfficialFormDoc; value: string; onChange?: (v: string) => void; preview?: boolean }) {
  const uid = useId();
  return (
    <section className="rounded-xl border border-border bg-[var(--royal-50)]/50 p-5 dark:bg-white/[0.03]">
      <p className="flex items-center gap-2 font-display text-base font-semibold text-primary">
        <PenLine className="h-4 w-4" /> Declaration and signature
      </p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{doc.signatureStatement}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor={uid} className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
            Type your full name to sign
          </label>
          <Input
            id={uid}
            disabled={preview}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="Full name"
            className="mt-1 font-display text-lg italic"
            autoComplete="name"
          />
        </div>
        <p className="text-xs text-muted-foreground sm:pb-2.5">
          Date: <Fragment>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</Fragment>
        </p>
      </div>
    </section>
  );
}
