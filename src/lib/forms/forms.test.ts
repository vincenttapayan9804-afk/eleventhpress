import { describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { DECIDED_FORMS, OFFICIAL_FORMS, SUBMISSION_FORM_IDS, formById, formPlatformPath, getFormDoc } from "@/lib/forms";
import { isAnonymous, isFieldShown, validateFormAnswers } from "@/lib/forms/validate";
import { buildFormPdf } from "@/lib/form-pdf";
import { guideById } from "@/lib/resources";
import type { ResourceBrand } from "@/lib/resources/tenant-brand";

const TENANT: ResourceBrand = {
  whitelabel: true,
  publisher: "Ron International Publishing",
  shortName: "Ron International Publishing",
  journalName: "Ron Journal",
  email: "editor@ron.org",
  issn: null,
  location: "Manila",
  baseUrl: "https://ron.eleventhpress.com",
  logoUrl: "https://ron.eleventhpress.com/pwa-icon/512",
  primaryHex: "#0f5132",
  accentHex: "#d4a017",
};

describe("Official Forms definitions", () => {
  test("twenty-six forms with unique ids, slugs and sequential codes", () => {
    expect(OFFICIAL_FORMS).toHaveLength(26);
    expect(new Set(OFFICIAL_FORMS.map((f) => f.id)).size).toBe(26);
    expect(new Set(OFFICIAL_FORMS.map((f) => f.slug)).size).toBe(26);
    OFFICIAL_FORMS.forEach((f, i) => expect(f.code).toBe(`EP-F-${String(i + 1).padStart(2, "0")}`));
  });

  test("every conditional question points at an earlier question and real options", () => {
    for (const f of OFFICIAL_FORMS) {
      for (const s of f.sections) {
        const ids = new Set<string>();
        for (const fd of s.repeat ? s.fields : f.sections.flatMap((x) => (x.repeat ? [] : x.fields))) ids.add(fd.id);
        for (const fd of s.fields) {
          if (!fd.showIf) continue;
          const parent = (s.repeat ? s.fields : f.sections.flatMap((x) => x.fields)).find((x) => x.id === fd.showIf!.field);
          expect(parent, `${f.code} ${fd.id}`).toBeDefined();
          for (const v of fd.showIf.in) expect(parent!.options?.some((o) => o.value === v), `${f.code} ${fd.id} → ${v}`).toBe(true);
        }
      }
    }
  });

  test("standards have URLs and related guides exist", () => {
    for (const f of OFFICIAL_FORMS) {
      expect(f.standards.length).toBeGreaterThan(0);
      for (const s of f.standards) expect(s.url).toMatch(/^https:\/\//);
      for (const g of f.relatedGuides) expect(guideById(g), `${f.code} → ${g}`).toBeDefined();
    }
  });

  test("the submission forms are exactly the author forms completed at submission", () => {
    for (const id of SUBMISSION_FORM_IDS) expect(formById(id)?.scope).toBe("submission");
    expect(OFFICIAL_FORMS.filter((f) => f.scope === "submission").map((f) => f.id).sort()).toEqual([...SUBMISSION_FORM_IDS].sort());
  });

  test("every decided request and public form has outcome labels, and only those", () => {
    for (const f of OFFICIAL_FORMS) {
      const decided = f.scope === "public" || ["form-authorship-change", "form-appeal", "form-withdrawal"].includes(f.id);
      expect(!!DECIDED_FORMS[f.id], f.code).toBe(decided);
    }
  });

  test("public forms are submitted on their own page; offline forms have no platform step", () => {
    for (const f of OFFICIAL_FORMS.filter((x) => x.scope === "public")) {
      expect(f.role).toBe("public");
      expect(formPlatformPath(f)).toBe(`/resources/forms/${f.slug}#submit`);
      // The editors need a way to reply unless the form allows anonymity.
      expect(f.sections.flatMap((s) => s.fields).some((x) => x.id === "contactEmail" && x.type === "email")).toBe(true);
    }
    expect(formPlatformPath(formById("form-publication-consent")!)).toBe("/resources/forms/participant-consent-for-publication");
  });

  test("tenant edition carries no Eleventh Press identity", () => {
    for (const f of OFFICIAL_FORMS) {
      const t = getFormDoc(f.slug, TENANT)!;
      const text = JSON.stringify({ ...t, standards: [] });
      expect(text).not.toMatch(/Eleventh Press|eleventhpress\.com|EP-F-/);
      expect(t.code).toBe(f.code.replace(/^EP-/, ""));
    }
  });
});

describe("validateFormAnswers", () => {
  const ethics = formById("form-ethics-consent")!;
  test("requires the questions that apply, and only those", () => {
    const r = validateFormAnswers(ethics, { involves: ["humans"], approvalStatus: "approved" }, "Maria Santos");
    expect(r.ok).toBe(false);
    const ok = validateFormAnswers(
      ethics,
      { involves: ["humans"], approvalStatus: "approved", committee: "REB", approvalReference: "R-1", approvalDate: "2026-03-03", consentType: "written", identifiable: "no", privacy: true, statement: "Approved.", animalLicence: "should be dropped" },
      "Maria Santos"
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.answers.animalLicence).toBeUndefined();
  });

  test("“None of these” cannot be combined", () => {
    const r = validateFormAnswers(ethics, { involves: ["none", "humans"] }, "Maria Santos");
    expect(r.ok).toBe(false);
  });

  test("needs a signature", () => {
    const r = validateFormAnswers(ethics, { involves: ["none"], noneConfirm: true, statement: "Not required." }, "  ");
    expect(r.ok).toBe(false);
  });

  test("per-author disclosure needs an entry for every author", () => {
    const coi = formById("form-author-coi")!;
    const authors = [{ name: "A" }, { name: "B" }];
    expect(validateFormAnswers(coi, { authors: [{ hasInterests: "none" }], statement: "None." }, "Ann Lee", { authors }).ok).toBe(false);
    const ok = validateFormAnswers(coi, { authors: [{ hasInterests: "none" }, { hasInterests: "some", categories: ["grants"], details: "DOST grant" }], statement: "B has a grant." }, "Ann Lee", { authors });
    expect(ok.ok).toBe(true);
  });

  test("an anonymous concern needs no signature or email; a named one needs both", () => {
    const concern = formById("form-report-concern")!;
    const base = { articleRef: "10.5555/ep.2026.1", concernType: ["images"], location: "Figure 2", evidence: "Panels B and D are identical.", goodFaith: true, confidential: true };
    const anon = validateFormAnswers(concern, { ...base, anonymous: "yes", contactEmail: "dropped@example.org" }, "");
    expect(anon.ok).toBe(true);
    if (anon.ok) {
      expect(anon.signedName).toBe("Anonymous");
      expect(anon.answers.contactEmail).toBeUndefined();
      expect(isAnonymous(concern, anon.answers)).toBe(true);
    }
    expect(validateFormAnswers(concern, { ...base, anonymous: "no" }, "Ana Cruz").ok).toBe(false);
    expect(validateFormAnswers(concern, { ...base, anonymous: "no", contactEmail: "ana@example.org" }, "Ana Cruz").ok).toBe(true);
    // Other forms never become anonymous.
    expect(validateFormAnswers(formById("form-complaint")!, { anonymous: "yes" }, "").ok).toBe(false);
  });

  test("isFieldShown follows radio and checkbox answers", () => {
    expect(isFieldShown({ showIf: { field: "x", in: ["a"] } }, { x: "a" })).toBe(true);
    expect(isFieldShown({ showIf: { field: "x", in: ["a"] } }, { x: ["b", "a"] })).toBe(true);
    expect(isFieldShown({ showIf: { field: "x", in: ["a"] } }, { x: "b" })).toBe(false);
  });
});

describe("form PDFs", () => {
  test("blank editions are fillable PDFs with real form fields", async () => {
    for (const f of OFFICIAL_FORMS) {
      const pdf = await PDFDocument.load(await buildFormPdf(f));
      const fields = pdf.getForm().getFields();
      expect(fields.length, f.code).toBeGreaterThan(5);
      expect(fields.some((x) => x.getName().startsWith("signature_full_name")), f.code).toBe(true);
    }
  }, 60000);

  test("a signed record is a flat document with the answers", async () => {
    const doc = formById("form-ai-disclosure")!;
    const v = validateFormAnswers(doc, { used: "no", statement: "No generative AI tools were used." }, "Maria Santos");
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const buf = await buildFormPdf(doc, undefined, { id: "rec1", answers: v.answers, signedName: v.signedName, signedAt: new Date(), status: "SUBMITTED", statusLabel: "Signed" });
    const pdf = await PDFDocument.load(buf);
    expect(pdf.getForm().getFields()).toHaveLength(0);
  });
});
