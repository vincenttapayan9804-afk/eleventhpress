/**
 * Checks a person's answers to an Official Form against its definition and
 * returns a clean copy holding only the fields that were shown to them.
 * Shared by the browser (to say what is missing before sending) and the
 * server (which never trusts the browser).
 */
import type { FormAnswers, FormField, FormSection, ListedAuthorAnswer, OfficialFormDoc } from "./types";

const DEFAULT_MAX = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether `field` is shown, given the other answers in the same scope. */
export function isFieldShown(field: Pick<FormField, "showIf">, answers: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const v = answers[field.showIf.field];
  if (Array.isArray(v)) return v.some((x) => field.showIf!.in.includes(String(x)));
  return typeof v === "string" && field.showIf.in.includes(v);
}

export interface FormContext {
  /** Authors on the manuscript, for sections repeated per author. */
  authors?: { name: string; email?: string }[];
}

export type ValidationResult =
  | { ok: true; answers: FormAnswers; signedName: string }
  | { ok: false; error: string };

function checkField(f: FormField, raw: unknown, where: string): { value?: unknown; error?: string } {
  const label = `${where}${f.label.replace(/\s*\(.*?\)\s*$/, "")}`;
  const max = f.maxLength ?? DEFAULT_MAX;
  switch (f.type) {
    case "notice":
      return {};
    case "attest":
      if (raw !== true) return { error: `Please confirm: “${f.label.slice(0, 90)}${f.label.length > 90 ? "…" : ""}”` };
      return { value: true };
    case "text":
    case "email":
    case "date":
    case "textarea": {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return f.required ? { error: `${label} is required.` } : {};
      if (s.length > max) return { error: `${label} is too long (maximum ${max} characters).` };
      if (f.type === "email" && !EMAIL_RE.test(s)) return { error: `${label} must be an email address.` };
      if (f.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)))) return { error: `${label} must be a date.` };
      return { value: s };
    }
    case "radio": {
      const s = typeof raw === "string" ? raw : "";
      if (!s) return f.required ? { error: `Please answer: ${label}` } : {};
      if (!f.options?.some((o) => o.value === s)) return { error: `${label}: choose one of the options.` };
      return { value: s };
    }
    case "checkboxes": {
      const list = Array.isArray(raw) ? [...new Set(raw.map(String))] : [];
      if (list.length === 0) return f.required ? { error: `Please tick at least one option: ${label}` } : {};
      if (list.some((v) => !f.options?.some((o) => o.value === v))) return { error: `${label}: unknown option.` };
      if (list.includes("none") && list.length > 1) return { error: `${label}: “None of these” can't be combined with other options.` };
      return { value: list };
    }
    case "authorList": {
      const list = Array.isArray(raw) ? raw : [];
      const clean: ListedAuthorAnswer[] = [];
      for (const [i, a] of list.entries()) {
        const o = (a ?? {}) as Record<string, unknown>;
        const name = String(o.name ?? "").trim().slice(0, 200);
        const email = String(o.email ?? "").trim().toLowerCase().slice(0, 200);
        if (!name && !email) continue;
        if (!name || !EMAIL_RE.test(email)) return { error: `Author ${i + 1} needs a name and a valid email address.` };
        clean.push({
          name,
          email,
          affiliation: String(o.affiliation ?? "").trim().slice(0, 300) || undefined,
          orcid: String(o.orcid ?? "").trim().slice(0, 40) || undefined,
        });
      }
      if (clean.length === 0) return f.required ? { error: `${label}: add at least one author.` } : {};
      if (clean.length > 60) return { error: `${label}: at most 60 authors.` };
      return { value: clean };
    }
  }
}

function checkSection(s: FormSection, answers: Record<string, unknown>, where = ""): { values: Record<string, unknown>; error?: string } {
  const values: Record<string, unknown> = {};
  for (const f of s.fields) {
    if (f.type === "notice" || !isFieldShown(f, answers)) continue;
    const r = checkField(f, answers[f.id], where);
    if (r.error) return { values, error: r.error };
    if (r.value !== undefined) values[f.id] = r.value;
  }
  return { values };
}

export function validateFormAnswers(doc: OfficialFormDoc, input: unknown, signedNameInput: unknown, ctx: FormContext = {}): ValidationResult {
  const answers = (input && typeof input === "object" ? input : {}) as FormAnswers;
  const out: FormAnswers = {};
  for (const s of doc.sections) {
    if (s.repeat === "authors") {
      const rows = Array.isArray(answers.authors) ? answers.authors : [];
      const expected = ctx.authors?.length ?? rows.length;
      if (expected === 0) return { ok: false, error: "Add the manuscript's authors before completing the disclosure for each author." };
      if (rows.length !== expected) return { ok: false, error: "Complete the disclosure for every author." };
      out.authors = [];
      for (let i = 0; i < expected; i++) {
        const row = (rows[i] ?? {}) as Record<string, unknown>;
        const name = (ctx.authors?.[i]?.name ?? String(row.name ?? "")).trim().slice(0, 200) || `Author ${i + 1}`;
        const r = checkSection(s, row, `${name}: `);
        if (r.error) return { ok: false, error: r.error };
        out.authors.push({ name, ...(ctx.authors?.[i]?.email ? { email: ctx.authors[i].email } : {}), ...r.values });
      }
      continue;
    }
    const r = checkSection(s, answers);
    if (r.error) return { ok: false, error: r.error };
    Object.assign(out, r.values);
  }
  const signedName = typeof signedNameInput === "string" ? signedNameInput.trim().replace(/\s+/g, " ").slice(0, 200) : "";
  if (signedName.length < 3) return { ok: false, error: `Sign ${doc.code} by typing your full name.` };
  return { ok: true, answers: out, signedName };
}
