/**
 * The Official Forms, EP-F-01 to EP-F-11: the forms every author, peer
 * reviewer and editor completes, benchmarked against the same standards as
 * the official guides (src/lib/resources/guide-docs.ts) and worded to match
 * their policies. See ./types.ts for how one definition becomes the web
 * page, the PDF and the platform step.
 *
 * Text names "Eleventh Press"; tenant sites show it under their own name
 * through the same brandDeep rewrite the guides use.
 */
import type { BenchmarkStandard } from "@/lib/resources/types";
import type { FormField, FormOption, OfficialFormDoc } from "./types";

export const FORMS_EFFECTIVE = "2026-11-19";
const NEXT_REVIEW = "2027-11-19";
const VERSION = "1.0";

// ── Standards (shared) ────────────────────────────────────────────────
const S = {
  cope: {
    name: "COPE Core Practices",
    issuer: "Committee on Publication Ethics",
    edition: "Current edition",
    url: "https://publicationethics.org/core-practices",
  },
  icmje: {
    name: "ICMJE Recommendations",
    issuer: "International Committee of Medical Journal Editors",
    edition: "Current edition",
    url: "https://www.icmje.org/recommendations/",
  },
  icmjeCoi: {
    name: "ICMJE Disclosure of Interest form",
    issuer: "International Committee of Medical Journal Editors",
    edition: "Current version",
    url: "https://www.icmje.org/disclosure-of-interest/",
  },
  credit: {
    name: "CRediT Contributor Roles Taxonomy",
    issuer: "NISO",
    edition: "ANSI/NISO Z39.104-2022",
    url: "https://credit.niso.org/",
  },
  helsinki: {
    name: "Declaration of Helsinki",
    issuer: "World Medical Association",
    edition: "2024 revision",
    url: "https://www.wma.net/policies-post/wma-declaration-of-helsinki/",
  },
  cioms: {
    name: "International Ethical Guidelines for Health-related Research Involving Humans",
    issuer: "CIOMS with the World Health Organization",
    edition: "4th edition (2016)",
    url: "https://cioms.ch/publications/product/international-ethical-guidelines-for-health-related-research-involving-humans/",
  },
  phreb: {
    name: "National Ethical Guidelines for Research Involving Human Participants",
    issuer: "Philippine Health Research Ethics Board",
    edition: "2022 edition",
    url: "https://ethics.healthresearch.ph/",
  },
  dpa: {
    name: "Data Privacy Act of 2012 (Republic Act No. 10173)",
    issuer: "National Privacy Commission, Philippines",
    edition: "With its Implementing Rules and Regulations",
    url: "https://privacy.gov.ph/data-privacy-act/",
  },
  arrive: {
    name: "ARRIVE guidelines",
    issuer: "NC3Rs",
    edition: "ARRIVE 2.0 (2020)",
    url: "https://arriveguidelines.org/",
  },
  copeAi: {
    name: "COPE position statement: Authorship and AI tools",
    issuer: "Committee on Publication Ethics",
    edition: "2023",
    url: "https://publicationethics.org/guidance/cope-position/authorship-and-ai-tools",
  },
  wameAi: {
    name: "WAME Recommendations on Chatbots and Generative AI",
    issuer: "World Association of Medical Editors",
    edition: "Revised 2023",
    url: "https://wame.org/page3.php?id=106",
  },
  ccby: {
    name: "Creative Commons Attribution 4.0 International",
    issuer: "Creative Commons",
    edition: "CC BY 4.0 legal code",
    url: "https://creativecommons.org/licenses/by/4.0/legalcode",
  },
  transparency: {
    name: "Principles of Transparency and Best Practice in Scholarly Publishing",
    issuer: "COPE, DOAJ, OASPA and WAME",
    edition: "Version 4 (2022)",
    url: "https://doaj.org/apply/transparency/",
  },
  rrs: {
    name: "Rights Retention Strategy",
    issuer: "cOAlition S (Plan S)",
    edition: "Current",
    url: "https://www.coalition-s.org/rights-retention-strategy/",
  },
  copeReviewers: {
    name: "COPE Ethical Guidelines for Peer Reviewers",
    issuer: "Committee on Publication Ethics",
    edition: "Version 2 (2017)",
    url: "https://publicationethics.org/guidance/guideline/ethical-guidelines-peer-reviewers",
  },
  niso: {
    name: "Standard Terminology for Peer Review",
    issuer: "NISO",
    edition: "ANSI/NISO Z39.106-2023",
    url: "https://www.niso.org/publications/z39106-2023-peerreview",
  },
  copeEditors: {
    name: "COPE Code of Conduct and Best Practice Guidelines for Journal Editors",
    issuer: "Committee on Publication Ethics",
    edition: "2011",
    url: "https://publicationethics.org/files/Code_of_conduct_for_journal_editors_Mar11.pdf",
  },
} satisfies Record<string, Omit<BenchmarkStandard, "application">>;

function std(key: keyof typeof S, application: string): BenchmarkStandard {
  return { ...S[key], application };
}

const attest = (id: string, label: string, extra: Partial<FormField> = {}): FormField => ({ id, type: "attest", label, required: true, ...extra });
const opts = (...pairs: [string, string][]): FormOption[] => pairs.map(([value, label]) => ({ value, label }));

/** Relationship types shared by the reviewer and editor conflict-of-interest forms. */
const RELATIONSHIP_OPTIONS = opts(
  ["institution", "I work, or worked within the last three years, at the same institution as an author"],
  ["collaboration", "I collaborated or co-authored with an author within the last three years"],
  ["supervision", "I supervised, or was supervised by, an author"],
  ["personal", "I have a close personal or family relationship with an author"],
  ["financial", "I have a financial interest in the outcome (employment, consultancy, shares, patents, funding)"],
  ["competing", "I am working on, or have published, directly competing research"],
  ["views", "I hold strong personal, political or religious views that could affect my judgement of this work"],
  ["identity", "I believe I know the authors' identity despite anonymisation"],
  ["other", "Other (describe below)"]
);

export const OFFICIAL_FORMS: OfficialFormDoc[] = [
  // ── EP-F-01 ─────────────────────────────────────────────────────────
  {
    id: "form-author-declaration",
    slug: "author-declaration-and-originality-statement",
    code: "EP-F-01",
    title: "Author Declaration & Originality Statement",
    role: "author",
    audience: "Corresponding authors, on behalf of all authors",
    summary: "The corresponding author's declaration, for every author, that the work is original, not under consideration elsewhere, correctly attributed, and that every author qualifies for and approves the submission.",
    purpose: "To record, before peer review begins, the authors' assurance that the manuscript is original, submitted to Eleventh Press only, honestly authored and free of the integrity problems set out in the Publication Ethics & Research Integrity Statement.",
    when: "Completed once for every new manuscript, at submission.",
    where: "Dashboard → Submit a manuscript → step 4, Official declarations.",
    scope: "submission",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "ICMJE Recommendations", "CRediT (ANSI/NISO Z39.104-2022)"],
    standards: [
      std("icmje", "The four authorship criteria, the corresponding author's responsibilities and the rules on overlapping publication."),
      std("cope", "Core practices on authorship and contributorship, and on allegations of misconduct that a false declaration can trigger."),
      std("credit", "Contributor roles recorded for each author, so that contributions are transparent."),
    ],
    instructions: [
      "The corresponding author completes this form for all authors, after confirming each statement with every co-author.",
      "Every statement must be confirmed. If one is not true, contact the editorial office before you submit.",
      "Declare any earlier public version of the work, including preprints, conference abstracts and theses.",
      "Each co-author is emailed to confirm their authorship and contributor roles after you submit.",
    ],
    sections: [
      {
        heading: "Originality and prior dissemination",
        fields: [
          attest("original", "The manuscript is the original work of the listed authors and has not been published before, in whole or in part, in any language, except as declared below."),
          attest("notElsewhere", "The manuscript is not under consideration by any other journal or publisher, and will not be submitted elsewhere while Eleventh Press is considering it."),
          {
            id: "priorDissemination",
            type: "radio",
            label: "Has any version of this work been shared publicly before?",
            required: true,
            options: opts(
              ["none", "No"],
              ["preprint", "Yes, as a preprint"],
              ["conference", "Yes, as a conference abstract, poster or proceedings paper"],
              ["thesis", "Yes, as part of a thesis or dissertation"],
              ["other", "Yes, in another form"]
            ),
          },
          {
            id: "priorDetails",
            type: "textarea",
            label: "Details of the earlier version",
            help: "Give the server or venue, the date, and the DOI or URL. Preprints are not prior publication but must be declared.",
            required: true,
            showIf: { field: "priorDissemination", in: ["preprint", "conference", "thesis", "other"] },
          },
          {
            id: "relatedManuscripts",
            type: "textarea",
            label: "Related manuscripts under review or in press elsewhere (optional)",
            help: "Any manuscript that reports the same data, sample or analyses. Write “None” if there are none.",
          },
        ],
      },
      {
        heading: "Authorship",
        fields: [
          attest("icmjeCriteria", "Every listed author meets all four ICMJE criteria: a substantial contribution to the work; drafting or critical revision; approval of the final version; and accountability for all aspects of the work. Everyone who meets the criteria is listed."),
          attest("allApproved", "All authors have read and approved the submitted version and agree to its submission to Eleventh Press."),
          attest("acknowledged", "Contributors who do not meet the authorship criteria are named in the acknowledgements, with their permission."),
          attest("authorised", "As corresponding author, I am authorised by every co-author to make these declarations and to correspond with the editorial office on their behalf."),
        ],
      },
      {
        heading: "Research integrity",
        fields: [
          attest("attribution", "All quoted, paraphrased and reused material is attributed, and written permission has been obtained for any reused figure, table or image that requires it."),
          attest("imageIntegrity", "Images and figures have not been manipulated beyond adjustments applied to the whole image that do not obscure, remove or misrepresent information, or any exception is explained in the figure legend."),
          attest("dataRetention", "The authors keep the raw data underlying the results and will provide them to the editor on request."),
          attest("citation", "The reference list contains no citations added only to increase the citation counts of any author, journal or publisher."),
        ],
      },
    ],
    signatureStatement: "I declare, on behalf of all authors, that the information in this form is true and complete. I understand that a false declaration may lead to rejection, retraction and notification of the authors' institutions, following COPE guidance.",
    afterSubmission: [
      "The declaration is stored with the manuscript and shown to the handling editor.",
      "Each co-author receives an email asking them to confirm their authorship and contributor roles.",
      "A signed copy of the completed form can be downloaded from My Articles at any time.",
    ],
    faqs: [
      { q: "Does a preprint count as prior publication?", a: "No. A preprint is not prior publication, but it must be declared on this form and in the cover letter so that the editor can link the two versions." },
      { q: "One of my co-authors is unreachable. Can I still submit?", a: "No. Every author must agree to the submission. Wait until you can confirm the declarations with every co-author, or contact the editorial office." },
    ],
    relatedGuides: ["guide-author-submission", "guide-publication-ethics"],
    keywords: ["author declaration", "originality statement", "ICMJE authorship criteria", "duplicate submission", "preprint declaration", "submission form"],
    metaDescription: "Official Eleventh Press Author Declaration & Originality Statement (EP-F-01): originality, no simultaneous submission, preprint disclosure, ICMJE authorship and research integrity declarations.",
  },

  // ── EP-F-02 ─────────────────────────────────────────────────────────
  {
    id: "form-author-coi",
    slug: "author-conflict-of-interest-disclosure",
    code: "EP-F-02",
    title: "Author Conflict of Interest Disclosure",
    role: "author",
    audience: "Every author of a submitted manuscript",
    summary: "A disclosure for each author, in the categories of the ICMJE Disclosure of Interest form, of every financial and non-financial interest from the last 36 months that readers could see as relevant to the work.",
    purpose: "To let editors, reviewers and readers judge the work knowing every interest that could be perceived as influencing it, and to produce the competing-interests statement printed with the article.",
    when: "Completed for every author at submission, and updated whenever an interest changes before publication.",
    where: "Dashboard → Submit a manuscript → step 4, Official declarations.",
    scope: "submission",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["ICMJE Disclosure of Interest form", "ICMJE Recommendations", "COPE Core Practices"],
    standards: [
      std("icmjeCoi", "The disclosure categories and the 36-month look-back period used for each author."),
      std("icmje", "The principle that disclosure is about relationships readers could perceive as relevant, not only those the author believes are."),
      std("cope", "Core practice on conflicts of interest and competing interests."),
    ],
    instructions: [
      "Complete one entry for each author. Collect each co-author's own disclosure before you enter it; each author may also sign their own copy of the PDF edition.",
      "Disclose interests from the 36 months before submission, and any interest expected in the future.",
      "Disclose interests that a reader could see as relevant, even if you believe they did not influence the work.",
      "The statement at the end is printed with the published article.",
    ],
    sections: [
      {
        heading: "Disclosure for each author",
        repeat: "authors",
        intro: "Repeated for every author listed on the manuscript.",
        fields: [
          {
            id: "hasInterests",
            type: "radio",
            label: "Does this author have any interest to disclose?",
            required: true,
            options: opts(["none", "No interests to disclose"], ["some", "Yes, one or more interests to disclose"]),
          },
          {
            id: "categories",
            type: "checkboxes",
            label: "Type of interest (tick all that apply)",
            required: true,
            showIf: { field: "hasInterests", in: ["some"] },
            options: opts(
              ["funding", "Funding or support for this work"],
              ["grants", "Grants or contracts from any relevant organisation"],
              ["royalties", "Royalties or licences"],
              ["consulting", "Consulting fees"],
              ["honoraria", "Payments or honoraria for lectures, presentations or educational events"],
              ["testimony", "Payment for expert testimony"],
              ["travel", "Support for attending meetings or travel"],
              ["patents", "Patents planned, issued or pending"],
              ["boards", "Membership of an advisory or data-safety monitoring board"],
              ["leadership", "Leadership or fiduciary role in an organisation, society or advocacy group"],
              ["equity", "Stock or stock options"],
              ["materials", "Equipment, materials, drugs, medical writing or other services received"],
              ["otherFinancial", "Other financial interests"],
              ["nonFinancial", "Non-financial interests: personal relationships, affiliations, or strongly held beliefs relevant to the work"]
            ),
          },
          {
            id: "details",
            type: "textarea",
            label: "Details",
            help: "For each type ticked, name the organisation or person, the nature of the interest and the period it covers.",
            required: true,
            showIf: { field: "hasInterests", in: ["some"] },
          },
        ],
      },
      {
        heading: "Statement for publication",
        fields: [
          {
            id: "statement",
            type: "textarea",
            label: "Competing interests statement",
            help: "Printed with the article. If no author has an interest, write: “The authors declare no competing interests.”",
            required: true,
          },
        ],
      },
    ],
    signatureStatement: "I declare that each disclosure above was provided or confirmed by the author concerned and is complete. I will tell the editorial office at once if any interest changes before publication.",
    afterSubmission: [
      "The disclosures are visible to the handling editor; the statement for publication is printed with the article.",
      "Reviewers see the statement for publication, not the individual disclosures.",
      "An undisclosed interest discovered later is handled as set out in the Corrections, Retractions & Expressions of Concern Guide.",
    ],
    faqs: [
      { q: "My funder had no role in the study. Do I still disclose the grant?", a: "Yes. Disclose the funding, and say in the statement for publication that the funder had no role in the design, analysis or decision to publish." },
      { q: "Do non-financial interests really count?", a: "Yes. Personal relationships, affiliations and strongly held beliefs relevant to the work can be perceived as influencing it and should be disclosed." },
    ],
    relatedGuides: ["guide-author-submission", "guide-publication-ethics"],
    keywords: ["conflict of interest disclosure", "competing interests", "ICMJE disclosure form", "financial interests", "author disclosure"],
    metaDescription: "Official Eleventh Press Author Conflict of Interest Disclosure (EP-F-02): per-author financial and non-financial interests in the ICMJE categories, with the competing-interests statement for publication.",
  },

  // ── EP-F-03 ─────────────────────────────────────────────────────────
  {
    id: "form-ethics-consent",
    slug: "ethics-approval-and-informed-consent-declaration",
    code: "EP-F-03",
    title: "Ethics Approval & Informed Consent Declaration",
    role: "author",
    audience: "Corresponding authors of research manuscripts",
    summary: "The approving committee, reference and date for research involving people, personal data or animals, how informed consent was obtained, consent for publication of identifiable information, or why approval was not required.",
    purpose: "To confirm that research involving human participants, identifiable personal data, human material or animals was ethically reviewed and conducted with valid consent, and to produce the ethics statement printed with the article.",
    when: "Completed once for every new manuscript, at submission.",
    where: "Dashboard → Submit a manuscript → step 4, Official declarations.",
    scope: "submission",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["Declaration of Helsinki (2024)", "CIOMS Guidelines (2016)", "PHREB National Ethical Guidelines (2022)", "Data Privacy Act of 2012", "ARRIVE 2.0"],
    standards: [
      std("helsinki", "Ethics committee approval and informed consent for research involving human participants, identifiable human material or data."),
      std("cioms", "Ethics review and consent waivers for health-related research, including secondary use of data."),
      std("phreb", "Ethics review requirements for research conducted in the Philippines."),
      std("dpa", "Lawful processing of personal and sensitive personal information about research participants."),
      std("arrive", "Reporting of ethical approval, licences and welfare for research involving animals."),
      std("icmje", "Protection of research participants and consent for publication of identifiable information."),
    ],
    instructions: [
      "Answer for the research reported in the manuscript, not for the authors' wider programme.",
      "Give the committee's full name and institution, and the approval reference exactly as it appears on the approval letter.",
      "Keep the approval letter and consent records: the editor may ask to see them.",
      "If approval was not required or was waived, explain why and who decided.",
    ],
    sections: [
      {
        heading: "Type of research",
        fields: [
          {
            id: "involves",
            type: "checkboxes",
            label: "The research reported involves (tick all that apply)",
            required: true,
            options: opts(
              ["humans", "Human participants (surveys, interviews, experiments, trials, observation)"],
              ["personalData", "Identifiable personal data, records or human material (samples, tissue, images)"],
              ["animals", "Live animals, vertebrate or cephalopod"],
              ["field", "Field work involving protected species, sites, communities or Indigenous knowledge"],
              ["none", "None of these"]
            ),
          },
          attest("noneConfirm", "No ethics approval was required because the research did not involve human participants, identifiable personal data, human material, animals or protected field work.", {
            showIf: { field: "involves", in: ["none"] },
          }),
        ],
      },
      {
        heading: "Ethics approval",
        fields: [
          {
            id: "approvalStatus",
            type: "radio",
            label: "Ethics review",
            required: true,
            showIf: { field: "involves", in: ["humans", "personalData", "animals", "field"] },
            options: opts(
              ["approved", "Approved by an ethics committee or institutional review board"],
              ["exempt", "Reviewed and declared exempt by an ethics committee"],
              ["notRequired", "Not required under the applicable law or institutional policy"]
            ),
          },
          {
            id: "committee",
            type: "text",
            label: "Name of the committee and its institution",
            required: true,
            showIf: { field: "approvalStatus", in: ["approved", "exempt"] },
          },
          {
            id: "approvalReference",
            type: "text",
            label: "Approval or protocol reference number",
            required: true,
            showIf: { field: "approvalStatus", in: ["approved"] },
          },
          {
            id: "approvalDate",
            type: "date",
            label: "Date of approval",
            required: true,
            showIf: { field: "approvalStatus", in: ["approved"] },
          },
          {
            id: "exemptionReason",
            type: "textarea",
            label: "Why approval was not required, or the basis of the exemption",
            help: "Name the law, policy or committee decision relied on.",
            required: true,
            showIf: { field: "approvalStatus", in: ["exempt", "notRequired"] },
          },
        ],
      },
      {
        heading: "Informed consent",
        fields: [
          {
            id: "consentType",
            type: "radio",
            label: "How was informed consent obtained?",
            required: true,
            showIf: { field: "involves", in: ["humans", "personalData"] },
            options: opts(
              ["written", "Written informed consent from every participant (or a parent or guardian)"],
              ["oral", "Oral consent, documented and approved by the committee"],
              ["waived", "Consent waived by the ethics committee"],
              ["anonymised", "Not applicable: only fully anonymised secondary data were used"]
            ),
          },
          {
            id: "consentDetails",
            type: "textarea",
            label: "Details of the consent process or waiver",
            required: true,
            showIf: { field: "consentType", in: ["oral", "waived"] },
          },
          {
            id: "identifiable",
            type: "radio",
            label: "Does the manuscript contain any information or image that could identify an individual?",
            required: true,
            showIf: { field: "involves", in: ["humans", "personalData"] },
            options: opts(["no", "No"], ["yes", "Yes"]),
          },
          attest("publicationConsent", "Written consent for publication has been obtained from every identifiable individual (or their parent, guardian or next of kin) and can be provided to the editor on request.", {
            showIf: { field: "identifiable", in: ["yes"] },
          }),
          attest("privacy", "Personal data were collected, stored and processed lawfully, in line with the Data Privacy Act of 2012 or the equivalent law where the research took place.", {
            showIf: { field: "involves", in: ["humans", "personalData"] },
          }),
        ],
      },
      {
        heading: "Research involving animals",
        fields: [
          attest("animalCompliance", "The work complied with applicable animal-welfare law and institutional approval, and is reported following the ARRIVE 2.0 guidelines.", {
            showIf: { field: "involves", in: ["animals"] },
          }),
          {
            id: "animalLicence",
            type: "text",
            label: "Animal licence or protocol number",
            required: true,
            showIf: { field: "involves", in: ["animals"] },
          },
        ],
      },
      {
        heading: "Statement for publication",
        fields: [
          {
            id: "statement",
            type: "textarea",
            label: "Ethics statement",
            help: "Printed with the article, e.g. “Approved by the Research Ethics Board of [institution] (ref. 2026-014, 3 March 2026). All participants gave written informed consent.”",
            required: true,
          },
        ],
      },
    ],
    signatureStatement: "I declare that the research was conducted as described above and that the approval and consent records exist and will be provided to the editor on request.",
    afterSubmission: [
      "The declaration is shown to the handling editor, who may request the approval letter or consent forms.",
      "The ethics statement is printed with the article.",
      "Research found to lack required approval or consent is handled as set out in the Publication Ethics & Research Integrity Statement.",
    ],
    faqs: [
      { q: "My survey was anonymous. Do I need approval?", a: "Often yes: many institutions require review even for anonymous surveys. If your committee exempted it or your institution's policy did not require review, say so and name the policy." },
      { q: "Can I submit while approval is pending?", a: "No. Research must be approved before it begins; approval cannot be obtained retrospectively for work already done." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-author-submission", "guide-data-code-availability"],
    keywords: ["ethics approval", "informed consent", "IRB", "research ethics committee", "consent for publication", "ARRIVE", "Declaration of Helsinki"],
    metaDescription: "Official Eleventh Press Ethics Approval & Informed Consent Declaration (EP-F-03): ethics committee approval, informed consent, consent for publication, data privacy and animal research.",
  },

  // ── EP-F-04 ─────────────────────────────────────────────────────────
  {
    id: "form-ai-disclosure",
    slug: "generative-ai-use-disclosure",
    code: "EP-F-04",
    title: "Generative AI Use Disclosure",
    role: "author",
    audience: "Corresponding authors, on behalf of all authors",
    summary: "Whether, which and how generative AI or AI-assisted tools were used in the research or the writing, with the authors' confirmation that they verified every output and remain fully accountable.",
    purpose: "To make the use of generative AI transparent to editors, reviewers and readers, consistent with the principle that AI tools cannot be authors and that authors are accountable for everything in their manuscript.",
    when: "Completed once for every new manuscript, at submission, and updated for any revision in which AI use changes.",
    where: "Dashboard → Submit a manuscript → step 4, Official declarations.",
    scope: "submission",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE position on AI tools", "ICMJE Recommendations", "WAME Recommendations on Generative AI", "Data Privacy Act of 2012"],
    standards: [
      std("copeAi", "AI tools cannot meet authorship requirements; their use must be disclosed and authors remain responsible."),
      std("icmje", "Disclosure of AI-assisted technologies in the cover letter and the manuscript, and authors' responsibility for accuracy and citations."),
      std("wameAi", "Specifying the tool, version and purpose, and the prohibition on listing chatbots as authors."),
      std("dpa", "Not entering participants' personal data into third-party AI services without a lawful basis."),
    ],
    instructions: [
      "Declare any generative AI or AI-assisted tool used to write, translate, analyse data, write code, create figures or find literature.",
      "Spelling and grammar checkers that only correct, and do not generate, text do not need to be declared.",
      "Describe the use in the manuscript's methods or acknowledgements as well.",
      "Every AI-assisted output, and especially every reference, must have been checked by the authors.",
    ],
    sections: [
      {
        heading: "Use of generative AI",
        fields: [
          {
            id: "used",
            type: "radio",
            label: "Were generative AI or AI-assisted tools used at any stage of the research or the preparation of the manuscript?",
            required: true,
            options: opts(["no", "No"], ["yes", "Yes"]),
          },
          {
            id: "tools",
            type: "textarea",
            label: "Tools used",
            help: "Name, version and provider of each tool, e.g. “ChatGPT (GPT-5), OpenAI”.",
            required: true,
            showIf: { field: "used", in: ["yes"] },
          },
          {
            id: "purposes",
            type: "checkboxes",
            label: "Purposes (tick all that apply)",
            required: true,
            showIf: { field: "used", in: ["yes"] },
            options: opts(
              ["language", "Language editing, proofreading or translation"],
              ["drafting", "Drafting or rewriting text"],
              ["literature", "Searching or summarising the literature"],
              ["analysis", "Data analysis or statistics"],
              ["code", "Writing or debugging code"],
              ["figures", "Creating or editing figures, images or tables"],
              ["other", "Other"]
            ),
          },
          {
            id: "description",
            type: "textarea",
            label: "How and where the tools were used",
            help: "Which sections or outputs, what the tool did, and how the authors checked the results.",
            required: true,
            showIf: { field: "used", in: ["yes"] },
          },
          attest("verified", "The authors reviewed, edited and verified all AI-assisted output, including every reference and citation, and take full responsibility for the content of the manuscript.", {
            showIf: { field: "used", in: ["yes"] },
          }),
          attest("notAuthor", "No AI tool is listed or credited as an author.", { showIf: { field: "used", in: ["yes"] } }),
          attest("noImages", "No AI-generated image is presented as research data. Any AI-generated illustration is labelled as such in its caption.", {
            showIf: { field: "used", in: ["yes"] },
          }),
          attest("noPersonalData", "No confidential information or participants' personal data were entered into an AI tool without a lawful basis and appropriate safeguards.", {
            showIf: { field: "used", in: ["yes"] },
          }),
        ],
      },
      {
        heading: "Statement for publication",
        fields: [
          {
            id: "statement",
            type: "textarea",
            label: "AI use statement",
            help: "Printed with the article, e.g. “No generative AI tools were used in this work.” or “The authors used [tool] to improve the language of the Introduction and reviewed and edited the output.”",
            required: true,
          },
        ],
      },
    ],
    signatureStatement: "I declare, on behalf of all authors, that this disclosure is complete and accurate.",
    afterSubmission: [
      "The disclosure is shown to the handling editor and the statement is printed with the article.",
      "Undisclosed AI use found later is handled as set out in the Publication Ethics & Research Integrity Statement.",
    ],
    faqs: [
      { q: "I only used a grammar checker. Do I need to declare it?", a: "Not if it only corrected spelling and grammar. If it rewrote or generated text, declare it." },
      { q: "Can an AI tool be listed as an author?", a: "No. AI tools cannot take responsibility for the work, approve it or be held accountable, so they cannot be authors." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-author-submission"],
    keywords: ["generative AI disclosure", "AI use statement", "ChatGPT in research", "AI authorship policy", "COPE AI position"],
    metaDescription: "Official Eleventh Press Generative AI Use Disclosure (EP-F-04): which AI tools were used, for what, how outputs were verified, and the AI use statement printed with the article.",
  },

  // ── EP-F-05 ─────────────────────────────────────────────────────────
  {
    id: "form-licence-to-publish",
    slug: "licence-to-publish-agreement",
    code: "EP-F-05",
    title: "Licence to Publish Agreement",
    role: "author",
    audience: "Corresponding authors, on behalf of all authors and any copyright owner",
    summary: "The agreement under which authors keep their copyright, grant Eleventh Press a non-exclusive licence to publish, and publish the article open access under CC BY 4.0.",
    purpose: "To set out, before publication, who owns the copyright, what rights the authors grant the publisher, the open licence readers receive, and the warranties the authors give.",
    when: "Agreed once for every new manuscript, at submission. It takes effect only if the article is published.",
    where: "Dashboard → Submit a manuscript → step 4, Official declarations.",
    scope: "submission",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["CC BY 4.0", "Principles of Transparency (COPE/DOAJ/OASPA/WAME)", "Plan S Rights Retention Strategy", "COPE Core Practices"],
    standards: [
      std("ccby", "The licence under which every article is published and may be shared and adapted with attribution."),
      std("transparency", "Clear statements of copyright ownership and licensing terms for authors and readers."),
      std("rrs", "Authors' retained right to share their accepted manuscript immediately under CC BY 4.0."),
      std("cope", "Core practice on intellectual property."),
    ],
    instructions: [
      "Read the terms below in full. They take effect only if the article is published.",
      "If your employer or a government owns the copyright, say so and make sure you are authorised to sign for them.",
      "Declare any third-party material in the manuscript and confirm that permission was obtained.",
    ],
    sections: [
      {
        heading: "Terms of the licence",
        fields: [
          { id: "termCopyright", type: "notice", label: "1. Copyright. The authors (or the copyright owner named below) keep the copyright in the article. Nothing in this agreement transfers copyright to the publisher." },
          { id: "termLicence", type: "notice", label: "2. Licence to the publisher. The authors grant Eleventh Press a worldwide, non-exclusive, royalty-free licence to publish, reproduce, distribute, display, archive and translate the article in all formats and media, including PDF, HTML and JATS XML; to register its metadata and DOI; and to deposit it with indexing, discovery and preservation services." },
          { id: "termOpen", type: "notice", label: "3. Open access. The article is published under the Creative Commons Attribution 4.0 International licence (CC BY 4.0). Anyone may share and adapt it for any purpose, provided the original authors and source are credited." },
          { id: "termRetention", type: "notice", label: "4. Rights retention. The authors may deposit any version of the work, including the accepted manuscript, in any repository immediately and under CC BY 4.0, regardless of any other agreement." },
          { id: "termWarranty", type: "notice", label: "5. Warranties. The authors confirm that they have the right to enter into this agreement; that the article is original and does not infringe anyone's copyright or other rights; that it contains nothing unlawful or defamatory; and that permission has been obtained for any third-party material." },
          { id: "termLapse", type: "notice", label: "6. If the article is not published. If the manuscript is rejected or withdrawn, this agreement lapses and all rights remain with the authors." },
          { id: "termFees", type: "notice", label: "7. Fees. Any article processing charge is set out in the published fee policy and is separate from, and never influences, the editorial decision." },
        ],
      },
      {
        heading: "Copyright owner and third-party material",
        fields: [
          {
            id: "copyrightOwner",
            type: "radio",
            label: "Who owns the copyright in the article?",
            required: true,
            options: opts(
              ["authors", "The authors"],
              ["employer", "The authors' employer or institution"],
              ["government", "A government (the work is a government work or in the public domain)"],
              ["other", "Another person or organisation"]
            ),
          },
          {
            id: "copyrightOwnerName",
            type: "text",
            label: "Name of the copyright owner",
            required: true,
            showIf: { field: "copyrightOwner", in: ["employer", "government", "other"] },
          },
          {
            id: "thirdParty",
            type: "radio",
            label: "Does the manuscript include material owned by someone else (figures, tables, images, long quotations)?",
            required: true,
            options: opts(["no", "No"], ["yes", "Yes, and permission to publish it under the article's licence has been obtained"]),
          },
          {
            id: "thirdPartyDetails",
            type: "textarea",
            label: "List the material and its owner",
            required: true,
            showIf: { field: "thirdParty", in: ["yes"] },
          },
        ],
      },
      {
        heading: "Agreement",
        fields: [
          attest("authorised", "I am authorised to sign this agreement on behalf of all authors and, where applicable, the copyright owner named above."),
          attest("agree", "On behalf of all authors, I agree to the terms of this licence, which take effect if the article is published."),
        ],
      },
    ],
    signatureStatement: "Signed on behalf of all authors and any copyright owner named in this agreement.",
    afterSubmission: [
      "The agreement is stored with the manuscript and takes effect on publication.",
      "The published article shows the authors as copyright holders and carries the CC BY 4.0 licence.",
      "A signed copy can be downloaded from My Articles at any time.",
    ],
    faqs: [
      { q: "Do I give up my copyright?", a: "No. You keep the copyright. You grant the publisher a non-exclusive licence to publish, and readers receive the CC BY 4.0 licence." },
      { q: "Can I post my accepted manuscript in my institution's repository?", a: "Yes, immediately and under CC BY 4.0, under the rights-retention term of this agreement." },
    ],
    relatedGuides: ["guide-author-submission", "guide-apc-waiver"],
    keywords: ["licence to publish", "copyright agreement", "CC BY 4.0", "open access licence", "author rights", "rights retention"],
    metaDescription: "Official Eleventh Press Licence to Publish Agreement (EP-F-05): authors keep copyright, grant a non-exclusive licence to publish, and publish open access under CC BY 4.0 with rights retention.",
  },

  // ── EP-F-06 ─────────────────────────────────────────────────────────
  {
    id: "form-authorship-change",
    slug: "authorship-change-request",
    code: "EP-F-06",
    title: "Authorship Change Request",
    role: "author",
    audience: "Corresponding authors of a submitted manuscript",
    summary: "A request to add, remove or reorder authors, or change the corresponding author, after submission, with the reason, the proposed author list and every author's agreement.",
    purpose: "To make sure that any change to the author list after submission is justified, agreed by every author on the original and proposed lists, and approved by the handling editor before publication, as COPE guidance requires.",
    when: "Completed whenever the author list must change after submission and before publication. After publication, a change requires a formal correction.",
    where: "Dashboard → My Articles → the manuscript → Official forms → Authorship change request.",
    scope: "article-request",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["ICMJE Recommendations", "COPE Core Practices", "CRediT (ANSI/NISO Z39.104-2022)"],
    standards: [
      std("icmje", "Authorship criteria that any added author must meet and any removed author no longer meets."),
      std("cope", "Core practice on authorship: changes require the agreement of all authors and are resolved before publication."),
      std("credit", "Contributor roles of each added author."),
    ],
    instructions: [
      "Agree the change with every author on both the original and the proposed lists, including anyone being removed, before you submit this request.",
      "Give the full proposed author list in the final order.",
      "The handling editor decides the request. If it is approved, the author list is updated and every author is asked to confirm by email.",
      "A disputed change is not made. The editor follows COPE guidance and may contact the authors' institutions.",
    ],
    sections: [
      {
        heading: "The change requested",
        fields: [
          {
            id: "changeTypes",
            type: "checkboxes",
            label: "Type of change (tick all that apply)",
            required: true,
            options: opts(
              ["add", "Add one or more authors"],
              ["remove", "Remove one or more authors"],
              ["order", "Change the order of authors"],
              ["corresponding", "Change the corresponding author"],
              ["details", "Correct an author's name, affiliation or ORCID iD"]
            ),
          },
          {
            id: "reason",
            type: "textarea",
            label: "Reason for each change",
            help: "Explain why each change is needed and why it was not made before submission.",
            required: true,
          },
          {
            id: "addedContributions",
            type: "textarea",
            label: "Contribution of each added author",
            help: "Their CRediT roles and how they meet all four ICMJE criteria.",
            required: true,
            showIf: { field: "changeTypes", in: ["add"] },
          },
        ],
      },
      {
        heading: "Proposed author list",
        fields: [
          {
            id: "proposedAuthors",
            type: "authorList",
            label: "Authors in their final order",
            help: "The first author listed becomes the first author of the article. Include everyone who will remain an author.",
            required: true,
          },
          {
            id: "newCorresponding",
            type: "text",
            label: "Email address of the new corresponding author",
            showIf: { field: "changeTypes", in: ["corresponding"] },
            required: true,
          },
        ],
      },
      {
        heading: "Agreement of all authors",
        fields: [
          attest("allAgree", "Every author on the original and the proposed author lists has agreed to this change in writing."),
          attest("removedAgree", "Each author being removed has agreed in writing to their removal, and the reason has been explained to them.", {
            showIf: { field: "changeTypes", in: ["remove"] },
          }),
          attest("confirmByEmail", "I understand that, if the request is approved, every author on the proposed list will be asked to confirm their authorship by email."),
        ],
      },
    ],
    signatureStatement: "I declare that every author has agreed to the change requested above and that the information in this request is true.",
    afterSubmission: [
      "The handling editor is notified and reviews the request.",
      "If it is approved, the author list on the manuscript is updated and each new author receives an authorship confirmation email.",
      "If it is declined or disputed, the author list stays as submitted and the editor explains why.",
    ],
    faqs: [
      { q: "Can authors be changed after the article is published?", a: "Only through a formal correction, which is rare and requires the agreement of all authors. See the Corrections, Retractions & Expressions of Concern Guide." },
      { q: "A co-author disagrees with the change. What happens?", a: "The change is not made. The editor follows COPE guidance on authorship disputes and may refer the matter to the authors' institutions." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-author-submission", "guide-corrections-retractions"],
    keywords: ["authorship change", "add author after submission", "remove author", "author order", "COPE authorship dispute"],
    metaDescription: "Official Eleventh Press Authorship Change Request (EP-F-06): add, remove or reorder authors after submission, with the reason, the proposed list and every author's agreement.",
  },

  // ── EP-F-07 ─────────────────────────────────────────────────────────
  {
    id: "form-reviewer-coi",
    slug: "reviewer-conflict-of-interest-declaration",
    code: "EP-F-07",
    title: "Reviewer Conflict of Interest Declaration",
    role: "reviewer",
    audience: "Peer reviewers invited to review a manuscript",
    summary: "The invited reviewer's declaration, before accepting, of any relationship with the authors or interest in the subject that could prevent an impartial review.",
    purpose: "To make sure every manuscript is reviewed by someone without a conflicting interest, and that any possible conflict is known to the editor before the review begins.",
    when: "Completed for every review invitation, before accepting it.",
    where: "Dashboard → Reviewer queue → Accept invitation.",
    scope: "review",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Ethical Guidelines for Peer Reviewers", "ICMJE Recommendations", "ANSI/NISO Z39.106-2023"],
    standards: [
      std("copeReviewers", "Declaring all potential competing interests and declining to review where a conflict prevents an unbiased review."),
      std("icmje", "Reviewers' disclosure of relationships and activities that could bias their opinion of the manuscript."),
      std("niso", "Review models and the identity transparency of reviewers and authors."),
    ],
    instructions: [
      "Read the title and abstract, then declare any relationship with the authors or interest in the work.",
      "If you have a conflict that prevents an impartial review, say so: the invitation is declined and the editor is told why.",
      "If you are unsure, disclose the possible conflict and let the editor decide.",
      "If a conflict becomes apparent during the review, stop and tell the editor at once.",
    ],
    sections: [
      {
        heading: "Competing interests",
        fields: [
          {
            id: "conflict",
            type: "radio",
            label: "Do you have a competing interest with this manuscript or its authors?",
            required: true,
            options: opts(
              ["none", "No, I have no competing interest"],
              ["possible", "Possibly: I am disclosing an interest for the editor to assess, and I believe I can still review impartially"],
              ["yes", "Yes: I have a competing interest and cannot review impartially, so I decline"]
            ),
          },
          {
            id: "relationships",
            type: "checkboxes",
            label: "Nature of the interest (tick all that apply)",
            required: true,
            showIf: { field: "conflict", in: ["possible", "yes"] },
            options: RELATIONSHIP_OPTIONS,
          },
          {
            id: "details",
            type: "textarea",
            label: "Details",
            help: "Who or what the interest involves, and when.",
            required: true,
            showIf: { field: "conflict", in: ["possible", "yes"] },
          },
        ],
      },
      {
        heading: "Undertakings",
        fields: [
          attest("expertise", "I have the expertise to assess this manuscript, or I will tell the editor which parts I cannot assess.", {
            showIf: { field: "conflict", in: ["none", "possible"] },
          }),
          attest("deadline", "I can complete my report within the deadline given in the invitation, or I will agree a new date with the editor.", {
            showIf: { field: "conflict", in: ["none", "possible"] },
          }),
          attest("ongoing", "I will tell the editor at once if a competing interest becomes apparent during the review."),
        ],
      },
    ],
    signatureStatement: "I declare that this declaration is complete and true.",
    afterSubmission: [
      "No competing interest: the invitation is accepted and the review form opens.",
      "A possible interest: the invitation is accepted and the editor is told, so that they can decide whether to keep or replace you.",
      "A competing interest: the invitation is declined and the editor is told the reason.",
    ],
    faqs: [
      { q: "I think I know who the authors are in a double-blind review. What should I do?", a: "Tick “I believe I know the authors' identity” and explain. The editor decides whether you can still review." },
      { q: "I reviewed this manuscript for another journal. Is that a conflict?", a: "Not necessarily, but disclose it so the editor can decide." },
    ],
    relatedGuides: ["guide-reviewer-handbook", "guide-publication-ethics"],
    keywords: ["reviewer conflict of interest", "peer reviewer declaration", "competing interests peer review", "reviewer recusal"],
    metaDescription: "Official Eleventh Press Reviewer Conflict of Interest Declaration (EP-F-07): declaring relationships with the authors or interests in the work before accepting a review invitation.",
  },

  // ── EP-F-08 ─────────────────────────────────────────────────────────
  {
    id: "form-reviewer-confidentiality",
    slug: "reviewer-confidentiality-and-ai-undertaking",
    code: "EP-F-08",
    title: "Reviewer Confidentiality & AI Undertaking",
    role: "reviewer",
    audience: "Every peer reviewer",
    summary: "The reviewer's standing undertaking to keep every manuscript confidential, never upload it to AI tools, protect anonymity, and review fairly, constructively and without coercive citation.",
    purpose: "To protect authors' unpublished work and the integrity of peer review by recording each reviewer's agreement to the conduct set out in the Reviewer Handbook.",
    when: "Signed once, before the reviewer's first review. It applies to every manuscript they review afterwards.",
    where: "Asked for automatically the first time a reviewer accepts an invitation.",
    scope: "once",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Ethical Guidelines for Peer Reviewers", "ICMJE Recommendations", "Data Privacy Act of 2012"],
    standards: [
      std("copeReviewers", "Confidentiality, not using unpublished information, objectivity, and not contacting authors directly."),
      std("icmje", "Reviewers must not upload manuscripts to software or AI tools that cannot assure confidentiality."),
      std("dpa", "Protection of any personal data that reviewers receive with a manuscript."),
    ],
    instructions: ["Read each undertaking. You sign once; it covers every manuscript you review for Eleventh Press until you withdraw from reviewing."],
    sections: [
      {
        heading: "Confidentiality",
        fields: [
          attest("confidential", "I will treat every manuscript and its supplementary material, data and correspondence as confidential, and will not share or discuss it with anyone without the editor's permission."),
          attest("noUse", "I will not use any information from an unpublished manuscript for my own work or advantage, or for anyone else's."),
          attest("colleagues", "I will not involve a colleague or student in a review without the editor's permission, and I will name them to the editor."),
          attest("destroy", "I will not keep copies of a manuscript after the review is complete."),
        ],
      },
      {
        heading: "Use of AI tools",
        fields: [
          attest("noUpload", "I will not upload a manuscript, its data, its figures or any part of my report about it to a generative AI or other tool that cannot guarantee confidentiality."),
          attest("aiLanguage", "If I use an AI tool to improve the language of my own report, I will not include any content from the manuscript, I will remain responsible for every word, and I will tell the editor."),
        ],
      },
      {
        heading: "Fair and constructive review",
        fields: [
          attest("anonymity", "I will not try to identify the authors of an anonymised manuscript, and I will not contact any author directly about a manuscript."),
          attest("objective", "I will review objectively and constructively, without personal criticism, and will base my assessment only on the work."),
          attest("noCoercion", "I will not ask authors to cite my own work, or anyone else's, unless the citation is genuinely needed to improve the manuscript."),
          attest("misconduct", "I will tell the editor in confidence if I suspect plagiarism, data fabrication, image manipulation or other misconduct, and will not investigate it myself."),
          attest("personalData", "I will protect any personal data I receive with a manuscript and use it only for the review."),
        ],
      },
    ],
    signatureStatement: "I agree to these undertakings for every manuscript I review for Eleventh Press. My obligation of confidentiality continues after I stop reviewing.",
    afterSubmission: [
      "The undertaking is recorded on your account; you are not asked again unless the form is revised.",
      "A signed copy can be downloaded from your dashboard at any time.",
    ],
    faqs: [
      { q: "Can I ask a doctoral student to help with my review?", a: "Only with the editor's permission. Name the student to the editor; they are bound by the same confidentiality." },
      { q: "Can I use AI to summarise the manuscript for me?", a: "No. Uploading any part of the manuscript to an AI tool that cannot guarantee confidentiality breaches this undertaking." },
    ],
    relatedGuides: ["guide-reviewer-handbook", "guide-publication-ethics"],
    keywords: ["reviewer confidentiality agreement", "peer review AI policy", "reviewer code of conduct", "confidential peer review"],
    metaDescription: "Official Eleventh Press Reviewer Confidentiality & AI Undertaking (EP-F-08): confidentiality, no uploading manuscripts to AI tools, anonymity and fair, constructive review.",
  },

  // ── EP-F-09 ─────────────────────────────────────────────────────────
  {
    id: "form-editor-coi",
    slug: "editor-conflict-of-interest-and-recusal-declaration",
    code: "EP-F-09",
    title: "Editor Conflict of Interest & Recusal Declaration",
    role: "editor",
    audience: "Editors and associate editors handling a manuscript",
    summary: "The handling editor's declaration, for each manuscript, that they have no competing interest, or their recusal so that another editor handles it.",
    purpose: "To make sure no editor makes a decision on a manuscript where a competing interest exists, and to record the recusal when one does.",
    when: "Completed for every manuscript, before the editor's first editorial decision on it.",
    where: "Asked for automatically the first time an editor makes a decision on a manuscript.",
    scope: "editor-article",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "COPE Code of Conduct for Journal Editors", "ICMJE Recommendations"],
    standards: [
      std("cope", "Core practice on conflicts of interest: editors declare interests and recuse themselves."),
      std("copeEditors", "Editors' systems for managing their own conflicts of interest and those of their staff."),
      std("icmje", "Editors who make final decisions recuse themselves from decisions where they have a relevant conflict."),
    ],
    instructions: [
      "Read the manuscript's title, abstract and author list, then declare any interest.",
      "If you have a competing interest, recuse yourself: you will not be able to make decisions on this manuscript, and the editorial office will reassign it.",
      "If a conflict becomes apparent later, recuse yourself at once and tell the editorial office.",
    ],
    sections: [
      {
        heading: "Competing interests",
        fields: [
          {
            id: "conflict",
            type: "radio",
            label: "Do you have a competing interest with this manuscript or its authors?",
            required: true,
            options: opts(["none", "No, I have no competing interest"], ["yes", "Yes, I have a competing interest and recuse myself from this manuscript"]),
          },
          {
            id: "relationships",
            type: "checkboxes",
            label: "Nature of the interest (tick all that apply)",
            required: true,
            showIf: { field: "conflict", in: ["yes"] },
            options: [{ value: "author", label: "I am an author of the manuscript or contributed to the work" }, ...RELATIONSHIP_OPTIONS.filter((o) => o.value !== "identity")],
          },
          {
            id: "details",
            type: "textarea",
            label: "Details",
            required: true,
            showIf: { field: "conflict", in: ["yes"] },
          },
        ],
      },
      {
        heading: "Undertakings",
        fields: [
          attest("merit", "I will base my decisions only on the manuscript's importance, originality, validity and relevance to the journal's scope, regardless of the authors' nationality, institution, gender, ethnicity, religion, political views or seniority, and regardless of any fee or waiver.", {
            showIf: { field: "conflict", in: ["none"] },
          }),
          attest("ongoing", "I will recuse myself at once and tell the editorial office if a competing interest becomes apparent later."),
        ],
      },
    ],
    signatureStatement: "I declare that this declaration is complete and true.",
    afterSubmission: [
      "No competing interest: your decision is recorded and you continue to handle the manuscript.",
      "A competing interest: you are recused, the platform blocks your decisions on this manuscript, and the other editors are notified to reassign it.",
    ],
    faqs: [
      { q: "A co-author of mine from five years ago submitted a manuscript. Must I recuse?", a: "The three-year window is a guide, not a rule. If the relationship could be perceived as influencing you, declare it and recuse." },
      { q: "Who handles a manuscript submitted by an editor?", a: "Another editor with no competing interest. The submitting editor has no access to the manuscript's review." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-reviewer-handbook"],
    keywords: ["editor conflict of interest", "editor recusal", "editorial independence", "COPE editors"],
    metaDescription: "Official Eleventh Press Editor Conflict of Interest & Recusal Declaration (EP-F-09): each handling editor's declaration of competing interests and recusal, per manuscript.",
  },

  // ── EP-F-10 ─────────────────────────────────────────────────────────
  {
    id: "form-editor-code",
    slug: "editor-code-of-conduct-and-confidentiality-agreement",
    code: "EP-F-10",
    title: "Editor Code of Conduct & Confidentiality Agreement",
    role: "editor",
    audience: "Editors, associate editors and editorial board members",
    summary: "Each editor's standing agreement to decide on merit and independently, keep manuscripts and reviewer identities confidential, manage conflicts, protect peer review and follow COPE when integrity concerns arise.",
    purpose: "To record every editor's commitment to the editorial standards Eleventh Press publishes in its guides, so that authors, reviewers and indexers can rely on them.",
    when: "Signed once, before an editor's first editorial decision, and again whenever the code is revised.",
    where: "Asked for automatically the first time an editor makes a decision.",
    scope: "once",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "COPE Code of Conduct for Journal Editors", "ICMJE Recommendations", "Principles of Transparency", "Data Privacy Act of 2012"],
    standards: [
      std("copeEditors", "The duties of editors to readers, authors and reviewers, and the management of editorial independence."),
      std("cope", "The ten core practices, from peer-review processes to post-publication discussions and corrections."),
      std("icmje", "Editorial freedom, confidentiality of manuscripts and the editors' use of AI tools."),
      std("transparency", "Published, consistently applied editorial and peer-review policies."),
      std("dpa", "Protection of authors', reviewers' and participants' personal data."),
    ],
    instructions: ["Read each commitment. You sign once; it applies to every manuscript you handle until you leave the editorial team."],
    sections: [
      {
        heading: "Your role",
        fields: [
          { id: "position", type: "text", label: "Editorial position (e.g. Associate Editor, Education)", required: true },
          { id: "affiliation", type: "text", label: "Institution", required: true },
        ],
      },
      {
        heading: "Decisions and independence",
        fields: [
          attest("merit", "I will decide on manuscripts on their merit and fit with the journal's scope alone, applying the published policies consistently to every author."),
          attest("independence", "I will not let commercial considerations, including article processing charges or waiver requests, influence any editorial decision."),
          attest("conflicts", "I will complete the Editor Conflict of Interest & Recusal Declaration (EP-F-09) for every manuscript and will never handle my own submission or that of a close collaborator."),
        ],
      },
      {
        heading: "Confidentiality and data",
        fields: [
          attest("confidential", "I will keep every manuscript, review and editorial discussion confidential, and protect reviewers' identities as the review model requires."),
          attest("noAi", "I will not upload manuscripts, reviews or decision letters to any generative AI or other tool that cannot guarantee confidentiality."),
          attest("personalData", "I will process authors', reviewers' and participants' personal data only for editorial purposes and in line with the Data Privacy Act of 2012."),
        ],
      },
      {
        heading: "Integrity of peer review and the record",
        fields: [
          attest("reviewers", "I will invite only qualified reviewers, verify their identity (for example through ORCID or an institutional email address), and never use reviewer suggestions without checking them."),
          attest("misconduct", "I will handle suspected misconduct, paper-mill activity and review manipulation by following the COPE flowcharts and the Publication Ethics & Research Integrity Statement."),
          attest("corrections", "I will correct the record promptly and transparently, following the Corrections, Retractions & Expressions of Concern Guide."),
          attest("appeals", "I will refer appeals and complaints about my own decisions to an editor who was not involved in them."),
        ],
      },
    ],
    signatureStatement: "I agree to this code of conduct for as long as I hold an editorial role at Eleventh Press. My obligation of confidentiality continues after I leave it.",
    afterSubmission: [
      "The agreement is recorded on your account; you are asked again only when the code is revised.",
      "A signed copy can be downloaded from your dashboard at any time.",
    ],
    faqs: [
      { q: "Does this apply to editorial board members who only advise?", a: "Yes. Anyone who sees manuscripts or reviews, or influences decisions, signs the code." },
      { q: "What happens if the code is revised?", a: "You are asked to sign the new version before your next decision." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-reviewer-handbook", "guide-corrections-retractions"],
    keywords: ["editor code of conduct", "editorial confidentiality agreement", "COPE code of conduct editors", "editorial independence"],
    metaDescription: "Official Eleventh Press Editor Code of Conduct & Confidentiality Agreement (EP-F-10): merit-based, independent decisions, confidentiality, AI use, reviewer integrity and COPE-aligned handling of misconduct.",
  },

  // ── EP-F-11 ─────────────────────────────────────────────────────────
  {
    id: "form-appeal",
    slug: "appeal-of-an-editorial-decision",
    code: "EP-F-11",
    title: "Appeal of an Editorial Decision",
    role: "author",
    audience: "Corresponding authors of a rejected manuscript",
    summary: "A request to reconsider a rejection on the grounds of a factual error, a misunderstanding, an undisclosed conflict of interest or a procedural error, considered once by an editor not involved in the decision.",
    purpose: "To give authors a fair, documented route to have a decision reconsidered, as COPE core practice on complaints and appeals requires.",
    when: "Submitted within 30 days of a rejection. Only one appeal can be made for each manuscript.",
    where: "Dashboard → My Articles → the rejected manuscript → Official forms → Appeal a decision.",
    scope: "article-request",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "COPE Code of Conduct for Journal Editors", "Principles of Transparency"],
    standards: [
      std("cope", "Core practice on complaints and appeals: a clear, published process, handled by someone not involved in the decision."),
      std("copeEditors", "Editors not reversing decisions without serious reason, and documenting how appeals are handled."),
      std("transparency", "A publicly stated appeals process."),
    ],
    instructions: [
      "Appeal only if you believe the decision was based on a factual error, a misunderstanding of the work, an undisclosed conflict of interest or a failure to follow the published process.",
      "There is no appeal against a decision that the manuscript is outside the journal's scope.",
      "Respond point by point, quoting the reviewer or editor comments you dispute. New data or analyses are a new submission, not an appeal.",
      "Do not submit the manuscript elsewhere while the appeal is being considered.",
    ],
    sections: [
      {
        heading: "Grounds for appeal",
        fields: [
          {
            id: "grounds",
            type: "checkboxes",
            label: "Grounds (tick all that apply)",
            required: true,
            options: opts(
              ["factual", "A factual error in a review or in the decision"],
              ["misunderstanding", "A reviewer or the editor misunderstood a central part of the work"],
              ["conflict", "An undisclosed competing interest or bias of a reviewer or editor"],
              ["procedure", "The published peer-review process was not followed"]
            ),
          },
          {
            id: "argument",
            type: "textarea",
            label: "Your case, point by point",
            help: "Quote each comment you dispute and explain, with evidence, why it is wrong.",
            required: true,
            maxLength: 12000,
          },
          {
            id: "evidence",
            type: "textarea",
            label: "Supporting evidence (optional)",
            help: "References, links or other material that supports your case.",
          },
          {
            id: "outcome",
            type: "radio",
            label: "What are you asking for?",
            required: true,
            options: opts(
              ["rereview", "Reconsideration with additional peer review"],
              ["reconsider", "Reconsideration of the decision by another editor"]
            ),
          },
        ],
      },
      {
        heading: "Acknowledgements",
        fields: [
          attest("notScope", "I understand that decisions on scope cannot be appealed."),
          attest("once", "I understand that the appeal is considered once, by an editor not involved in the original decision, and that the outcome is final."),
          attest("notElsewhere", "The manuscript will not be submitted elsewhere while this appeal is being considered."),
        ],
      },
    ],
    signatureStatement: "I declare, on behalf of all authors, that the information in this appeal is true.",
    afterSubmission: [
      "The appeal is acknowledged and the editors are notified. An editor not involved in the decision considers it.",
      "You receive a written outcome: the decision is upheld, or the manuscript is reconsidered.",
      "The outcome is final, and is recorded with the manuscript.",
    ],
    faqs: [
      { q: "How long does an appeal take?", a: "Most appeals are answered within 30 days. If further review is needed, the editor tells you the expected timetable." },
      { q: "Can I appeal more than once?", a: "No. Each manuscript can be appealed once, and the outcome is final." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-reviewer-handbook"],
    keywords: ["appeal editorial decision", "journal appeal process", "reconsideration of rejection", "COPE appeals"],
    metaDescription: "Official Eleventh Press Appeal of an Editorial Decision (EP-F-11): grounds, point-by-point case and outcome sought, considered once by an editor not involved in the decision.",
  },
];

/** The five forms completed as part of the manuscript submission form. */
export const SUBMISSION_FORM_IDS = [
  "form-author-declaration",
  "form-author-coi",
  "form-ethics-consent",
  "form-ai-disclosure",
  "form-licence-to-publish",
] as const;
