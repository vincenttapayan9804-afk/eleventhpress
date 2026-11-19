/**
 * Shapes for the Official Forms (Resources → Forms). One definition drives
 * every edition of a form: the crawlable page at /resources/forms/<slug>,
 * the branded PDF (blank, or filled in as a signed record) and the
 * fill-in steps inside the platform (submission, review invitations,
 * editorial decisions, appeals and authorship changes). The validator in
 * ./validate.ts checks answers against the same definition, so what a
 * person is shown and what the server accepts can't drift apart.
 */
import type { BenchmarkStandard, Faq } from "@/lib/resources/types";

export type FormFieldType =
  /** One line of text. */
  | "text"
  | "email"
  | "date"
  /** Several lines of text. */
  | "textarea"
  /** Pick exactly one option. */
  | "radio"
  /** Pick any number of options. */
  | "checkboxes"
  /** A single statement the signer must tick to confirm. */
  | "attest"
  /** Read-only text (terms, notices) printed as part of the form. */
  | "notice"
  /** A list of authors: name, email, affiliation, ORCID iD. */
  | "authorList";

export interface FormOption {
  value: string;
  label: string;
}

/** Shown only when another field's answer is (or includes) one of `in`. */
export interface ShowIf {
  field: string;
  in: string[];
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  help?: string;
  placeholder?: string;
  /** Required whenever the field is shown. "attest" fields are always required. */
  required?: boolean;
  options?: FormOption[];
  showIf?: ShowIf;
  maxLength?: number;
}

export interface FormSection {
  heading: string;
  intro?: string;
  /**
   * "authors": the section is completed once for every author listed on the
   * submission (answers are stored as `answers.authors[i][fieldId]`).
   */
  repeat?: "authors";
  fields: FormField[];
}

/** Where in the platform a form is completed. */
export type FormScope =
  /** As a step of the manuscript submission form, once per manuscript. */
  | "submission"
  /** By the corresponding author on a submitted manuscript (a request the editor decides). */
  | "article-request"
  /** By the reviewer, once per review invitation. */
  | "review"
  /** By the editor, once per manuscript they handle. */
  | "editor-article"
  /** Once per person, before their first review or editorial decision. */
  | "once";

export type FormRole = "author" | "reviewer" | "editor";

export interface OfficialFormDoc {
  id: string;
  slug: string;
  /** Controlled document code ("EP-F-01"). */
  code: string;
  title: string;
  role: FormRole;
  audience: string;
  summary: string;
  purpose: string;
  /** When the form is completed, in one sentence. */
  when: string;
  /** Where in the platform it is completed, in one sentence. */
  where: string;
  scope: FormScope;
  version: string;
  effective: string;
  nextReview: string;
  benchmarks: string[];
  standards: BenchmarkStandard[];
  /** Short numbered instructions printed before the form. */
  instructions: string[];
  sections: FormSection[];
  /** The declaration the signer makes above their signature. */
  signatureStatement: string;
  /** What happens once the form is submitted. */
  afterSubmission: string[];
  faqs: Faq[];
  relatedGuides: string[];
  keywords: string[];
  metaDescription: string;
}

/** A field's answer: text, a list of options, a tick, or a list of authors. */
export type FormAnswer = string | string[] | boolean | ListedAuthorAnswer[] | undefined;

export interface ListedAuthorAnswer {
  name: string;
  email: string;
  affiliation?: string;
  orcid?: string;
}

export type FormAnswers = Record<string, unknown> & {
  /** Per-author answers for a section with `repeat: "authors"`. */
  authors?: Record<string, unknown>[];
};
