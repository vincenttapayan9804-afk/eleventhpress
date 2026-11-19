/**
 * The Official Forms, EP-F-01 to EP-F-26: the forms every author, peer
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
  equator: {
    name: "EQUATOR Network reporting guidelines",
    issuer: "EQUATOR Network",
    edition: "Current library",
    url: "https://www.equator-network.org/reporting-guidelines/",
  },
  consort: {
    name: "CONSORT Statement",
    issuer: "CONSORT Group",
    edition: "CONSORT 2025",
    url: "https://www.consort-spirit.org/",
  },
  prisma: {
    name: "PRISMA Statement",
    issuer: "PRISMA Group",
    edition: "PRISMA 2020",
    url: "https://www.prisma-statement.org/",
  },
  stm: {
    name: "STM Permissions Guidelines",
    issuer: "International Association of STM Publishers",
    edition: "Current edition",
    url: "https://www.stm-assoc.org/intellectual-property/permissions/permissions-guidelines/",
  },
  crossmark: {
    name: "Crossmark",
    issuer: "Crossref",
    edition: "Current",
    url: "https://www.crossref.org/services/crossmark/",
  },
  copeRetraction: {
    name: "COPE Retraction Guidelines",
    issuer: "Committee on Publication Ethics",
    edition: "Version 2 (2019)",
    url: "https://publicationethics.org/guidance/guideline/retraction-guidelines",
  },
  copeFlowcharts: {
    name: "COPE Flowcharts",
    issuer: "Committee on Publication Ethics",
    edition: "Current",
    url: "https://publicationethics.org/guidance/Flowcharts",
  },
  doaj: {
    name: "DOAJ Guide to Applying",
    issuer: "Directory of Open Access Journals",
    edition: "Current",
    url: "https://doaj.org/apply/guide/",
  },
  planS: {
    name: "Plan S Principles and Implementation",
    issuer: "cOAlition S",
    edition: "Current",
    url: "https://www.coalition-s.org/addendum-to-the-coalition-s-guidance-on-the-implementation-of-plan-s/principles-and-implementation/",
  },
  npc: {
    name: "NPC Circulars on data subject rights",
    issuer: "National Privacy Commission, Philippines",
    edition: "Current",
    url: "https://privacy.gov.ph/circulars/",
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
          attest("publicationConsent", "Written consent for publication has been obtained from every identifiable individual (or their parent, guardian or next of kin), using the Participant Consent for Publication form (EP-F-12) or an equivalent, and can be provided to the editor on request.", {
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

  // ── EP-F-12 ─────────────────────────────────────────────────────────
  {
    id: "form-publication-consent",
    slug: "participant-consent-for-publication",
    code: "EP-F-12",
    title: "Participant Consent for Publication",
    role: "author",
    audience: "Research participants, patients and other identifiable individuals (completed with the authors)",
    summary: "The consent of a person who can be identified in a manuscript (in a photograph, video, case description, quotation or other detail) to that information being published open access, under CC BY 4.0, and indexed worldwide.",
    purpose: "To give the authors written, informed and specific consent from each identifiable individual before their information is published, as ICMJE and the Data Privacy Act of 2012 require. Research consent is not consent for publication.",
    when: "Signed by each identifiable individual (or their parent, guardian or legal representative) before the manuscript is submitted.",
    where: "Download the fillable PDF and complete it with the individual. The authors keep the signed form and confirm it in EP-F-03; the editor may ask to see it.",
    scope: "offline",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["ICMJE Recommendations", "COPE Core Practices", "Data Privacy Act of 2012", "Declaration of Helsinki (2024)"],
    standards: [
      std("icmje", "Written informed consent for publication from any patient or participant who could be identified, after they have seen the manuscript."),
      std("dpa", "Consent to the processing and publication of personal and sensitive personal information must be freely given, specific and informed."),
      std("helsinki", "Respect for the privacy and dignity of research participants."),
      std("cope", "Core practice on ethical oversight, including consent for publication."),
    ],
    instructions: [
      "Use one form for each identifiable individual. A parent or guardian signs for a child; a legal representative signs for a person who cannot consent.",
      "Show the individual the material that will be published (the image, the case description or the quotation) and the whole manuscript if they ask.",
      "Explain that the article will be open access and free for anyone to read, copy and reuse, and that once published it cannot be fully withdrawn.",
      "Keep the signed form securely for at least as long as the article is published. Do not upload it with the manuscript: confirm in EP-F-03 that you hold it.",
      "Removing names does not make a person unidentifiable if a relative, colleague or community member could still recognise them.",
    ],
    sections: [
      {
        heading: "The manuscript",
        fields: [
          { id: "manuscriptTitle", type: "text", label: "Title of the manuscript", required: true },
          { id: "authorName", type: "text", label: "Name of the author obtaining consent", required: true },
          { id: "authorEmail", type: "email", label: "Author's email address", required: true },
        ],
      },
      {
        heading: "The person who can be identified",
        fields: [
          { id: "subjectName", type: "text", label: "Full name of the person who can be identified", required: true },
          {
            id: "signer",
            type: "radio",
            label: "Who is signing this form?",
            required: true,
            options: opts(
              ["self", "The person themselves"],
              ["parent", "A parent or guardian (the person is a minor)"],
              ["representative", "A legal representative or next of kin (the person cannot consent or has died)"]
            ),
          },
          { id: "relationship", type: "text", label: "Relationship to the person, and why they cannot sign", required: true, showIf: { field: "signer", in: ["parent", "representative"] } },
          {
            id: "material",
            type: "checkboxes",
            label: "Material about the person that will be published (tick all that apply)",
            required: true,
            options: opts(
              ["photo", "Photographs or video"],
              ["clinical", "Clinical images, scans or test results"],
              ["case", "A case description or personal history"],
              ["quotes", "Quotations or interview extracts"],
              ["other", "Other information that could identify them"]
            ),
          },
          { id: "materialDetails", type: "textarea", label: "Describe the material (figure numbers, page or section)", required: true },
        ],
      },
      {
        heading: "Consent",
        intro: "The person (or the person signing for them) confirms each statement.",
        fields: [
          attest("seen", "I have seen the material about me (or the person I sign for) that will be published, and I have been offered the whole manuscript to read."),
          attest("openAccess", "I understand that the article will be published open access under a Creative Commons Attribution licence (CC BY 4.0): anyone, anywhere, may read, copy, translate and reuse it, and it will be indexed by search engines and databases."),
          attest("identifiable", "I understand that, although names are removed, someone who knows me may be able to recognise me."),
          attest("permanent", "I understand that I can withdraw this consent before publication, but that once the article is published it cannot be fully removed from the record."),
          attest("noEffect", "I understand that refusing or withdrawing consent will not affect my care, treatment or any other service I receive."),
          attest("voluntary", "I give this consent freely, and I have had the chance to ask questions."),
        ],
      },
      {
        heading: "Signatures",
        fields: [
          { id: "subjectSignedDate", type: "date", label: "Date signed by the person (or their representative)", required: true },
          { id: "witness", type: "text", label: "Name of the author or witness present (optional)" },
        ],
      },
    ],
    signatureStatement: "I, the person named above (or their parent, guardian or representative), give my consent to the publication of the material described in this form.",
    afterSubmission: [
      "The authors keep the signed form securely; it is not uploaded with the manuscript.",
      "The corresponding author confirms in EP-F-03 that consent for publication has been obtained from every identifiable individual.",
      "The editor may ask to see the form, in confidence, at any stage.",
    ],
    faqs: [
      { q: "Does research consent cover publication?", a: "No. Consent to take part in research is not consent to have identifiable information published. Use this form in addition to the study's own consent forms." },
      { q: "The person has died. Who signs?", a: "Their next of kin or legal representative. If no one can be found, contact the editorial office before you submit." },
      { q: "Can I just blur the eyes in a photograph?", a: "No. Masking eyes does not make a person unidentifiable. Obtain consent, or remove the image." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-author-submission"],
    keywords: ["consent for publication", "patient consent form", "identifiable image consent", "case report consent", "ICMJE consent"],
    metaDescription: "Official Eleventh Press Participant Consent for Publication (EP-F-12): written consent from each identifiable person before their image, case details or quotations are published open access.",
  },

  // ── EP-F-13 ─────────────────────────────────────────────────────────
  {
    id: "form-reporting-guideline",
    slug: "reporting-guideline-checklist-declaration",
    code: "EP-F-13",
    title: "Reporting Guideline Checklist Declaration",
    role: "author",
    audience: "Corresponding authors of research manuscripts",
    summary: "The EQUATOR reporting guideline the manuscript follows (CONSORT, PRISMA, STROBE, ARRIVE, COREQ and others), confirmation that its completed checklist is uploaded, or why no guideline applies.",
    purpose: "To make sure studies are reported completely and transparently, so that reviewers and readers can judge their methods and reproduce them.",
    when: "Completed once for every new manuscript, at submission.",
    where: "Dashboard → Submit a manuscript → step 4, Official declarations.",
    scope: "submission",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["EQUATOR Network", "CONSORT 2025", "PRISMA 2020", "STROBE", "ARRIVE 2.0", "ICMJE Recommendations"],
    standards: [
      std("equator", "The library of reporting guidelines by study design, and the expectation that journals ask for the relevant checklist."),
      std("consort", "Reporting of randomised trials, with the participant flow diagram."),
      std("prisma", "Reporting of systematic reviews and meta-analyses, with the flow diagram and protocol registration."),
      std("arrive", "Reporting of research involving animals."),
      std("icmje", "Journals encourage authors to follow the reporting guideline for their study design."),
    ],
    instructions: [
      "Find the guideline for your study design on the EQUATOR Network website. If several apply, choose the main design and mention the others.",
      "Complete the guideline's checklist, giving the page or section where each item is reported, and upload it as a supplementary file.",
      "Upload the flow diagram the guideline asks for (CONSORT, PRISMA, STARD) as a figure.",
      "If an item is not reported, say why in the checklist.",
    ],
    sections: [
      {
        heading: "Study design and guideline",
        fields: [
          {
            id: "guideline",
            type: "radio",
            label: "Which reporting guideline does the manuscript follow?",
            required: true,
            options: opts(
              ["consort", "CONSORT: randomised trial"],
              ["spirit", "SPIRIT: trial protocol"],
              ["prisma", "PRISMA: systematic review or meta-analysis"],
              ["strobe", "STROBE: observational study (cohort, case-control, cross-sectional)"],
              ["stard", "STARD: diagnostic accuracy study"],
              ["tripod", "TRIPOD: prediction model"],
              ["care", "CARE: case report"],
              ["arrive", "ARRIVE 2.0: animal research"],
              ["coreq", "COREQ or SRQR: qualitative research"],
              ["cheers", "CHEERS: economic evaluation"],
              ["squire", "SQUIRE: quality improvement"],
              ["other", "Another EQUATOR guideline"],
              ["none", "No reporting guideline applies to this manuscript"]
            ),
          },
          { id: "otherGuideline", type: "text", label: "Name of the guideline", required: true, showIf: { field: "guideline", in: ["other"] } },
          {
            id: "noneReason",
            type: "radio",
            label: "Why no guideline applies",
            required: true,
            showIf: { field: "guideline", in: ["none"] },
            options: opts(
              ["theory", "Theoretical, conceptual or mathematical work"],
              ["humanities", "Humanities or legal scholarship without an empirical study design"],
              ["methods", "Software, a method or a dataset description with no study of participants"],
              ["review", "A narrative review, commentary or perspective"],
              ["other", "Other (explain below)"]
            ),
          },
          { id: "noneDetails", type: "textarea", label: "Explanation", required: true, showIf: { field: "noneReason", in: ["other"] } },
        ],
      },
      {
        heading: "Checklist and registration",
        fields: [
          attest("checklistUploaded", "The completed checklist, with the page or section for every item, is uploaded as a supplementary file.", {
            showIf: { field: "guideline", in: ["consort", "spirit", "prisma", "strobe", "stard", "tripod", "care", "arrive", "coreq", "cheers", "squire", "other"] },
          }),
          attest("flowDiagram", "The flow diagram the guideline requires is included as a figure.", { showIf: { field: "guideline", in: ["consort", "prisma", "stard"] } }),
          {
            id: "registration",
            type: "text",
            label: "Trial or review registration number and registry (e.g. ClinicalTrials.gov, PROSPERO, OSF)",
            help: "Trials must be registered before the first participant is enrolled (ICMJE). Write “Not registered” and explain in the manuscript if a review was not registered.",
            required: true,
            showIf: { field: "guideline", in: ["consort", "spirit", "prisma"] },
          },
          {
            id: "dataSharing",
            type: "textarea",
            label: "Data-sharing plan for the trial",
            help: "ICMJE requires a data-sharing statement for clinical trials.",
            required: true,
            showIf: { field: "guideline", in: ["consort"] },
          },
        ],
      },
    ],
    signatureStatement: "I declare, on behalf of all authors, that the manuscript is reported as stated in this form.",
    afterSubmission: [
      "The editor checks the checklist during initial screening (EP-F-20).",
      "Reviewers are asked to assess the manuscript against the guideline you named (EP-F-18).",
      "A missing or incomplete checklist is returned to you before peer review.",
    ],
    faqs: [
      { q: "My study design isn't on the list.", a: "Choose “Another EQUATOR guideline” and name it. The EQUATOR library holds over 600 guidelines; if none fits, choose “No reporting guideline applies” and explain." },
      { q: "Do I have to report every checklist item?", a: "Report every item that applies. Where an item is not reported, say why in the checklist rather than leaving it blank." },
    ],
    relatedGuides: ["guide-author-submission", "guide-reviewer-handbook", "guide-data-code-availability"],
    keywords: ["reporting guideline checklist", "EQUATOR network", "CONSORT checklist", "PRISMA checklist", "STROBE", "ARRIVE"],
    metaDescription: "Official Eleventh Press Reporting Guideline Checklist Declaration (EP-F-13): the EQUATOR guideline a manuscript follows, its uploaded checklist, flow diagram and registration.",
  },

  // ── EP-F-14 ─────────────────────────────────────────────────────────
  {
    id: "form-third-party-permissions",
    slug: "third-party-material-permissions-declaration",
    code: "EP-F-14",
    title: "Third-Party Material Permissions Declaration",
    role: "author",
    audience: "Corresponding authors",
    summary: "Every figure, table, image, map, long quotation or other material in the manuscript that the authors did not create, its source, and the permission or licence that allows it to be published open access under CC BY 4.0.",
    purpose: "To make sure the article can lawfully be published and reused under CC BY 4.0, and that material owned by others is clearly marked so that readers know it is not covered by the article's licence.",
    when: "Completed once for every new manuscript, at submission.",
    where: "Dashboard → Submit a manuscript → step 4, Official declarations.",
    scope: "submission",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["CC BY 4.0", "STM Permissions Guidelines", "COPE Core Practices"],
    standards: [
      std("ccby", "What the article licence allows readers to do, and how third-party material is excluded from it."),
      std("stm", "How publishers grant and request permission to reuse figures and text extracts."),
      std("cope", "Core practice on intellectual property: attribution and permission for reused material."),
    ],
    instructions: [
      "List every item you did not create yourselves, including figures you redrew or adapted from someone else's.",
      "Permission must cover open-access publication and reuse under CC BY 4.0. Permission for print or subscription use only is not enough.",
      "Material that is already under CC BY, CC0 or in the public domain needs no permission, but must still be credited.",
      "Keep the permission letters or emails. The editor may ask to see them.",
      "If you cannot get permission, replace the item or describe it in the text with a citation.",
    ],
    sections: [
      {
        heading: "Third-party material",
        fields: [
          {
            id: "contains",
            type: "radio",
            label: "Does the manuscript include material the authors did not create?",
            required: true,
            options: opts(
              ["none", "No. All figures, tables, images and text are the authors' own"],
              ["open", "Yes, but all of it is under CC BY, CC0 or in the public domain"],
              ["permission", "Yes, including material that needs the owner's permission"]
            ),
          },
          {
            id: "items",
            type: "textarea",
            label: "Each item, its source and its licence or permission",
            help: "One per line, e.g. “Figure 2: reproduced from Santos et al. (2021), Journal X, © Publisher Y; permission granted 3 March 2026 for open-access reuse.”",
            required: true,
            maxLength: 8000,
            showIf: { field: "contains", in: ["open", "permission"] },
          },
          attest("permissionHeld", "Written permission is held for every item that needs it, and it covers open-access publication under CC BY 4.0, in all formats and media, worldwide.", { showIf: { field: "contains", in: ["permission"] } }),
          attest("credited", "Every item is credited in its legend or the text, and material not covered by CC BY 4.0 is marked as such (e.g. “© Owner, reproduced with permission; not covered by the article licence”).", {
            showIf: { field: "contains", in: ["open", "permission"] },
          }),
        ],
      },
      {
        heading: "Authors' own earlier work",
        fields: [
          {
            id: "ownPublished",
            type: "radio",
            label: "Does the manuscript reuse figures or text the authors published before?",
            required: true,
            options: opts(["no", "No"], ["yes", "Yes"]),
          },
          attest("ownPermission", "Where the earlier publisher holds copyright, its permission has been obtained, and the earlier publication is cited.", { showIf: { field: "ownPublished", in: ["yes"] } }),
        ],
      },
    ],
    signatureStatement: "I declare, on behalf of all authors, that this account of third-party material is complete and true.",
    afterSubmission: [
      "The editor checks the list during initial screening. Missing permissions are queried before peer review.",
      "At production, credits and licence notices for third-party items are typeset as given in the legends.",
      "If a permission problem is found after publication, the item is removed or replaced and a correction is published.",
    ],
    faqs: [
      { q: "I redrew a figure from another paper. Do I need permission?", a: "Usually, yes. An adaptation that keeps the original's creative content is still a derivative work. Cite it as “adapted from” and obtain permission unless the source is openly licensed." },
      { q: "The publisher only allows reuse in subscription journals.", a: "That permission is not enough for an open-access article. Ask for open-access reuse, replace the figure, or cite it in the text instead." },
    ],
    relatedGuides: ["guide-author-submission", "guide-publication-ethics", "guide-formatting-citation"],
    keywords: ["copyright permission figure", "third-party material", "reuse permission CC BY", "permission to reproduce figure"],
    metaDescription: "Official Eleventh Press Third-Party Material Permissions Declaration (EP-F-14): reused figures, tables and quotations, their sources and the permissions needed for CC BY 4.0 publication.",
  },

  // ── EP-F-15 ─────────────────────────────────────────────────────────
  {
    id: "form-reviewer-suggestions",
    slug: "suggested-and-opposed-reviewers",
    code: "EP-F-15",
    title: "Suggested & Opposed Reviewers",
    role: "author",
    audience: "Corresponding authors (optional suggestions)",
    summary: "Optional suggestions of independent experts who could review the manuscript, and people the authors ask not to be invited, with reasons. The editor is not bound by either.",
    purpose: "To help editors find qualified reviewers, and to let authors flag people with a conflict of interest, without compromising the independence of peer review.",
    when: "Completed once for every new manuscript, at submission. Suggestions are optional; the form records that none were made.",
    where: "Dashboard → Submit a manuscript → step 4, Official declarations.",
    scope: "submission",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "COPE Ethical Guidelines for Peer Reviewers", "ICMJE Recommendations"],
    standards: [
      std("cope", "Core practice on peer review processes, including the risk of manipulated reviews from author-suggested reviewers."),
      std("copeReviewers", "Reviewers with competing interests should not review."),
      std("icmje", "Authors may suggest or ask to exclude reviewers; editors decide."),
    ],
    instructions: [
      "Suggest only independent experts: not co-authors or collaborators from the last three years, not colleagues at your institution, and not people you supervise or who supervised you.",
      "Give an institutional email address that the editor can check. Editors verify every suggested reviewer independently.",
      "You may ask that up to three people are not invited, with a reason the editor can weigh.",
      "Never suggest yourself or a co-author under another name. Fabricated reviewer identities lead to rejection or retraction.",
    ],
    sections: [
      {
        heading: "Suggested reviewers",
        fields: [
          {
            id: "suggest",
            type: "radio",
            label: "Would you like to suggest reviewers?",
            required: true,
            options: opts(["no", "No, I leave the choice to the editor"], ["yes", "Yes"]),
          },
          {
            id: "suggested",
            type: "textarea",
            label: "Suggested reviewers",
            help: "One per line: name, position and institution, institutional email, and their relevant expertise.",
            required: true,
            maxLength: 4000,
            showIf: { field: "suggest", in: ["yes"] },
          },
          attest("independent", "None of the suggested reviewers has co-authored, collaborated or shared an institution with any author in the last three years, or has any other conflict of interest that I know of.", { showIf: { field: "suggest", in: ["yes"] } }),
        ],
      },
      {
        heading: "Opposed reviewers",
        fields: [
          {
            id: "oppose",
            type: "radio",
            label: "Is there anyone you ask the editor not to invite?",
            required: true,
            options: opts(["no", "No"], ["yes", "Yes"]),
          },
          {
            id: "opposed",
            type: "textarea",
            label: "People not to invite, and why",
            help: "Up to three, one per line: name, institution, email if known, and the reason (for example, a documented dispute or a directly competing project).",
            required: true,
            maxLength: 3000,
            showIf: { field: "oppose", in: ["yes"] },
          },
        ],
      },
      {
        heading: "Acknowledgement",
        fields: [attest("editorDecides", "I understand that the editor chooses the reviewers, may or may not invite anyone suggested, and will usually respect a reasoned request not to invite someone.")],
      },
    ],
    signatureStatement: "I declare that the information in this form is accurate and given in good faith.",
    afterSubmission: [
      "Your suggestions are seen only by the editors. They are never shown to reviewers.",
      "The editor checks each suggested reviewer's identity and independence before inviting anyone.",
      "When an editor invites someone you asked not to be invited, the platform warns them first.",
    ],
    faqs: [
      { q: "Must I suggest reviewers?", a: "No. Suggestions are optional. Answer “No” and the editor finds reviewers independently." },
      { q: "Will the people I oppose find out?", a: "No. The form is confidential to the editors." },
    ],
    relatedGuides: ["guide-author-submission", "guide-reviewer-handbook", "guide-publication-ethics"],
    keywords: ["suggest reviewers", "opposed reviewers", "exclude reviewers", "reviewer suggestions journal"],
    metaDescription: "Official Eleventh Press Suggested & Opposed Reviewers form (EP-F-15): optional, independent reviewer suggestions and reasoned requests not to invite someone.",
  },

  // ── EP-F-16 ─────────────────────────────────────────────────────────
  {
    id: "form-proof-approval",
    slug: "proof-approval-and-sign-off",
    code: "EP-F-16",
    title: "Proof Approval & Sign-off",
    role: "author",
    audience: "Corresponding authors, on behalf of all authors",
    summary: "The corresponding author's approval of the typeset proof for publication, or a list of corrections limited to errors introduced in typesetting and essential factual errors.",
    purpose: "To record that the authors checked the final version before it receives its DOI and becomes the version of record, and to keep late changes to what is essential.",
    when: "Completed when the accepted article is in production and its proof is ready, normally within 48 hours.",
    where: "Dashboard → My Articles → the accepted article → Official forms → Approve proof.",
    scope: "article-request",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["ICMJE Recommendations", "Crossref", "COPE Core Practices"],
    standards: [
      std("icmje", "All authors approve the final version to be published."),
      std("crossmark", "Once published, the version of record changes only through a correction notice."),
      std("cope", "Core practice on post-publication discussions and corrections."),
    ],
    instructions: [
      "Read the whole proof, including author names, affiliations, ORCID iDs, funding, figures, tables, equations and references.",
      "Correct only typesetting errors and essential factual errors. New results, new text or new references are not accepted at proof stage.",
      "Give each correction with its page and line, and the exact replacement text.",
      "Confirm that every co-author has seen the proof or agreed that you approve it for them.",
    ],
    sections: [
      {
        heading: "Your decision",
        fields: [
          {
            id: "decision",
            type: "radio",
            label: "The proof is",
            required: true,
            options: opts(["approved", "Approved for publication as it stands"], ["corrections", "Approved subject to the corrections listed below"]),
          },
          {
            id: "corrections",
            type: "textarea",
            label: "Corrections",
            help: "One per line: page, line or figure, the error, and the exact correction.",
            required: true,
            maxLength: 8000,
            showIf: { field: "decision", in: ["corrections"] },
          },
        ],
      },
      {
        heading: "Checks",
        fields: [
          attest("names", "Every author's name, affiliation, ORCID iD and contributor roles are correct, and the corresponding author is right."),
          attest("funding", "The funding, competing interests, ethics, data availability and AI-use statements are correct and complete."),
          attest("figures", "Figures, tables, equations and their legends are complete and correct."),
          attest("coauthors", "Every co-author has seen the proof or has authorised me to approve it on their behalf."),
          attest("final", "I understand that after publication the article can be changed only through a published correction."),
        ],
      },
    ],
    signatureStatement: "I approve this proof for publication on behalf of all authors.",
    afterSubmission: [
      "Approved: the production editor schedules publication.",
      "With corrections: the production editor makes the corrections and may send a revised proof.",
      "The signed approval is kept with the article.",
    ],
    faqs: [
      { q: "Can I add a reference I missed?", a: "Not at proof stage, unless it corrects an error of fact or attribution. Explain why in the corrections box and the editor will decide." },
      { q: "A co-author's name is misspelled in the proof.", a: "List it as a correction. Names are always corrected." },
    ],
    relatedGuides: ["guide-formatting-citation", "guide-corrections-retractions"],
    keywords: ["proof approval", "author proof sign-off", "galley proof corrections", "approve proof journal"],
    metaDescription: "Official Eleventh Press Proof Approval & Sign-off (EP-F-16): approval of the typeset proof, or essential corrections, before the version of record is published.",
  },

  // ── EP-F-17 ─────────────────────────────────────────────────────────
  {
    id: "form-withdrawal",
    slug: "manuscript-withdrawal-request",
    code: "EP-F-17",
    title: "Manuscript Withdrawal Request",
    role: "author",
    audience: "Corresponding authors, with the agreement of all authors",
    summary: "A request to withdraw a manuscript before publication, the reason for it, and confirmation that every author agrees. A published article cannot be withdrawn; it can only be corrected or retracted.",
    purpose: "To make sure a manuscript is withdrawn only with the agreement of all authors, for a stated reason, and that the editorial record shows why.",
    when: "Submitted at any time before publication.",
    where: "Dashboard → My Articles → the manuscript → Official forms → Request withdrawal.",
    scope: "article-request",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "COPE Retraction Guidelines", "ICMJE Recommendations"],
    standards: [
      std("cope", "Core practice on authorship disputes and on handling allegations; withdrawal must not be used to escape an investigation."),
      std("copeRetraction", "After publication, an article is retracted, not withdrawn, with a public notice."),
      std("icmje", "All authors share responsibility for the submission, including a decision to withdraw it."),
    ],
    instructions: [
      "Confirm with every co-author that they agree to the withdrawal.",
      "Give the real reason. If an error has been found, say what it is; the editor may need to know for other manuscripts.",
      "A manuscript under investigation for misconduct cannot be withdrawn until the investigation is closed.",
      "Do not submit the manuscript elsewhere until the editor confirms the withdrawal.",
    ],
    sections: [
      {
        heading: "Reason for withdrawal",
        fields: [
          {
            id: "reason",
            type: "radio",
            label: "Main reason",
            required: true,
            options: opts(
              ["error", "We found an error that affects the results or conclusions"],
              ["data", "Problems with the data, its ownership or its permissions"],
              ["authorship", "A dispute or change among the authors"],
              ["elsewhere", "We wish to submit to another journal"],
              ["time", "The review is taking longer than we can wait"],
              ["other", "Another reason"]
            ),
          },
          { id: "explanation", type: "textarea", label: "Explanation", help: "What happened and why the manuscript should be withdrawn.", required: true, maxLength: 4000 },
        ],
      },
      {
        heading: "Declarations",
        fields: [
          attest("allAgree", "Every author has been told of this request and agrees to the withdrawal."),
          attest("notPublished", "I understand that a published article cannot be withdrawn, and that this request applies only to a manuscript before publication."),
          attest("investigation", "I understand that a manuscript subject to an integrity concern cannot be withdrawn until the concern has been resolved."),
          attest("waitConfirmation", "We will not submit the manuscript elsewhere until the editor has confirmed the withdrawal."),
        ],
      },
    ],
    signatureStatement: "I request the withdrawal of this manuscript on behalf of all authors, and declare that the information above is true.",
    afterSubmission: [
      "The editors are notified and decide the request, normally within five working days.",
      "Once approved, the manuscript is withdrawn, reviewers are released, and you are told in writing.",
      "The withdrawal and its reason are kept in the editorial record, not published.",
    ],
    faqs: [
      { q: "Can I withdraw after acceptance?", a: "Yes, until the article is published. After publication only a correction or a retraction is possible." },
      { q: "Is there a fee for withdrawing?", a: "No. No fee is charged before acceptance, and none is charged for a withdrawal before publication." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-corrections-retractions", "guide-author-submission"],
    keywords: ["withdraw manuscript", "manuscript withdrawal request", "withdraw submission journal"],
    metaDescription: "Official Eleventh Press Manuscript Withdrawal Request (EP-F-17): withdrawal before publication, with the reason and the agreement of every author.",
  },

  // ── EP-F-18 ─────────────────────────────────────────────────────────
  {
    id: "form-reporting-assessment",
    slug: "reporting-guideline-assessment-for-reviewers",
    code: "EP-F-18",
    title: "Reporting Guideline Assessment",
    role: "reviewer",
    audience: "Peer reviewers of manuscripts that follow an EQUATOR reporting guideline",
    summary: "The reviewer's assessment of whether the manuscript reports the items its reporting guideline requires (methods, participants, outcomes, statistics, flow diagram, registration), alongside the review report.",
    purpose: "To check, consistently, that research is reported completely enough to be assessed and reproduced, as the EQUATOR Network recommends.",
    when: "Completed with the review report, for manuscripts whose authors declared a reporting guideline in EP-F-13.",
    where: "Asked for automatically when the reviewer submits the report.",
    scope: "review",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["EQUATOR Network", "CONSORT 2025", "PRISMA 2020", "COPE Ethical Guidelines for Peer Reviewers"],
    standards: [
      std("equator", "Reporting guidelines as a tool for peer review."),
      std("consort", "Trial reporting items reviewers check, including the flow diagram and registration."),
      std("prisma", "Review reporting items, including search, selection and risk of bias."),
      std("copeReviewers", "Reviewers give an objective, constructive assessment of the work."),
    ],
    instructions: [
      "Open the authors' completed checklist (in the supplementary files) beside the manuscript.",
      "Check that the items are actually reported where the checklist says, not just ticked.",
      "Rate each area, and list the items that are missing or inadequate. They are passed to the authors with your report.",
    ],
    sections: [
      {
        heading: "The guideline",
        fields: [
          {
            id: "checklistPresent",
            type: "radio",
            label: "Is the authors' completed checklist available?",
            required: true,
            options: opts(["yes", "Yes, and it gives page or section references"], ["partial", "Yes, but incomplete or without references"], ["no", "No, it is missing"]),
          },
          {
            id: "appropriate",
            type: "radio",
            label: "Is it the right guideline for the study design?",
            required: true,
            options: opts(["yes", "Yes"], ["no", "No (say which one applies below)"], ["unsure", "Not sure"]),
          },
        ],
      },
      {
        heading: "Assessment",
        intro: "Rate how completely each area is reported.",
        fields: [
          { id: "design", type: "radio", label: "Study design, setting and participants or sample", required: true, options: opts(["full", "Fully reported"], ["partial", "Partly reported"], ["missing", "Not reported"], ["na", "Not applicable"]) },
          { id: "methods", type: "radio", label: "Interventions, exposures, measures and procedures, in enough detail to replicate", required: true, options: opts(["full", "Fully reported"], ["partial", "Partly reported"], ["missing", "Not reported"], ["na", "Not applicable"]) },
          { id: "analysis", type: "radio", label: "Sample size, statistical or analytic methods, and handling of missing data", required: true, options: opts(["full", "Fully reported"], ["partial", "Partly reported"], ["missing", "Not reported"], ["na", "Not applicable"]) },
          { id: "results", type: "radio", label: "Results for every pre-specified outcome, with effect sizes and precision", required: true, options: opts(["full", "Fully reported"], ["partial", "Partly reported"], ["missing", "Not reported"], ["na", "Not applicable"]) },
          { id: "flow", type: "radio", label: "Flow diagram, registration and protocol", required: true, options: opts(["full", "Fully reported"], ["partial", "Partly reported"], ["missing", "Not reported"], ["na", "Not applicable"]) },
          { id: "limitations", type: "radio", label: "Limitations, bias and generalisability", required: true, options: opts(["full", "Fully reported"], ["partial", "Partly reported"], ["missing", "Not reported"], ["na", "Not applicable"]) },
          {
            id: "missingItems",
            type: "textarea",
            label: "Missing or inadequate items",
            help: "Name the checklist item and what is needed. Write “None” if reporting is complete.",
            required: true,
            maxLength: 6000,
          },
        ],
      },
    ],
    signatureStatement: "I declare that this assessment is my own, made in confidence and in good faith.",
    afterSubmission: [
      "The assessment is attached to your report and seen by the editor.",
      "Missing items are passed to the authors with the decision, so that they can be fixed in revision.",
    ],
    faqs: [
      { q: "The authors chose the wrong guideline.", a: "Say so under “Is it the right guideline?” and name the right one in the missing-items box. Assess against the right one if you can." },
      { q: "Does this replace my review report?", a: "No. It complements the report. Comment on the science, methods and conclusions in the report as usual." },
    ],
    relatedGuides: ["guide-reviewer-handbook", "guide-data-code-availability"],
    keywords: ["reviewer checklist", "reporting guideline peer review", "CONSORT review", "EQUATOR reviewer"],
    metaDescription: "Official Eleventh Press Reporting Guideline Assessment (EP-F-18): the reviewer's check that a manuscript reports what its EQUATOR guideline requires.",
  },

  // ── EP-F-19 ─────────────────────────────────────────────────────────
  {
    id: "form-open-review-consent",
    slug: "open-peer-review-consent",
    code: "EP-F-19",
    title: "Open Peer Review Consent",
    role: "reviewer",
    audience: "Peer reviewers of manuscripts under the journal's open-review option",
    summary: "The reviewer's own choice, for each review, whether their report may be published with the article and whether it is signed with their name. Without consent, the report stays confidential.",
    purpose: "To make sure no review report or reviewer identity is published without the reviewer's specific, informed consent, as NISO's peer-review terminology and the Data Privacy Act of 2012 expect.",
    when: "Completed with the review report, when the manuscript is under the open-review option.",
    where: "Asked for automatically when the reviewer submits the report.",
    scope: "review",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["NISO Z39.106-2023", "COPE Ethical Guidelines for Peer Reviewers", "Data Privacy Act of 2012", "CC BY 4.0"],
    standards: [
      std("niso", "Published reports and reviewer identity as separate, declared dimensions of a peer-review model."),
      std("copeReviewers", "Reviewers' confidentiality, and the journal's duty to tell reviewers how their reports are used."),
      std("dpa", "Publishing a reviewer's name is processing personal data and needs their consent."),
      std("ccby", "The licence under which a published report may be reused."),
    ],
    instructions: [
      "Your report is published only if the article is published, and only with your consent.",
      "You may agree to publish the report anonymously, signed with your name, or not at all. Your choice does not affect how the editor weighs your report.",
      "Write your report as you would for publication: comments to the editor are never published.",
    ],
    sections: [
      {
        heading: "Your choice",
        fields: [
          {
            id: "publishReport",
            type: "radio",
            label: "If the article is published, may your report be published with it?",
            required: true,
            options: opts(["yes", "Yes"], ["no", "No, keep my report confidential"]),
          },
          {
            id: "publishName",
            type: "radio",
            label: "Should the published report carry your name?",
            required: true,
            showIf: { field: "publishReport", in: ["yes"] },
            options: opts(["signed", "Yes, sign it with my name and ORCID iD"], ["anonymous", "No, publish it anonymously (as “Reviewer 1”)"]),
          },
          attest("licence", "I agree that my published report is released under CC BY 4.0, and that it may receive its own DOI.", { showIf: { field: "publishReport", in: ["yes"] } }),
          attest("editorComments", "I understand that my confidential comments to the editor are never published."),
        ],
      },
    ],
    signatureStatement: "I give the consent recorded in this form, for this review only.",
    afterSubmission: [
      "Your choice is stored with the review. On publication, only reports with consent are made public, and only signed ones carry your name.",
      "You can change your mind before the article is published by contacting the editorial office.",
    ],
    faqs: [
      { q: "Will declining affect the editor's view of my review?", a: "No. Consent is recorded separately from the report and has no bearing on how it is used in the decision." },
      { q: "Can I change my mind?", a: "Yes, until the article is published. After that the published report stays on the record." },
    ],
    relatedGuides: ["guide-reviewer-handbook"],
    keywords: ["open peer review consent", "publish review report", "signed peer review", "reviewer identity consent"],
    metaDescription: "Official Eleventh Press Open Peer Review Consent (EP-F-19): each reviewer's consent to publish their report, signed or anonymous, under CC BY 4.0.",
  },

  // ── EP-F-20 ─────────────────────────────────────────────────────────
  {
    id: "form-desk-screening",
    slug: "initial-editorial-screening-checklist",
    code: "EP-F-20",
    title: "Initial Editorial Screening Checklist",
    role: "editor",
    audience: "Handling editors, before peer review",
    summary: "The editor's documented checks before a manuscript goes to peer review: scope, declarations, similarity report, anonymisation, reporting checklist, ethics and quality, and the screening outcome.",
    purpose: "To make the desk decision consistent, fair and recorded, so that every manuscript sent to reviewers meets the same basic standard and every desk rejection has a stated reason.",
    when: "Completed once for each manuscript, before it is first sent to peer review.",
    where: "Asked for automatically the first time an editor sends a manuscript to review; also available in Editorial queue → the manuscript → Forms.",
    scope: "editor-article",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "COPE Code of Conduct for Journal Editors", "EQUATOR Network", "DOAJ"],
    standards: [
      std("cope", "Core practices on peer review processes and on ethical oversight before review."),
      std("copeEditors", "Editors' responsibility for fair, unbiased initial decisions with stated reasons."),
      std("equator", "Checking the reporting checklist before review."),
      std("doaj", "Journals describe and apply a quality-control process before publication."),
    ],
    instructions: [
      "Open the manuscript, its files, the Official Forms tab and the AI & checks tab.",
      "Answer every check from what you see, not from the authors' declarations alone.",
      "A desk rejection must give the authors a reason. A return asks the authors to fix specific problems before review.",
    ],
    sections: [
      {
        heading: "Checks",
        fields: [
          { id: "scope", type: "radio", label: "Within the journal's aims and scope", required: true, options: opts(["yes", "Yes"], ["no", "No"], ["borderline", "Borderline"]) },
          { id: "declarations", type: "radio", label: "Official declarations (EP-F-01 to EP-F-05, EP-F-13 to EP-F-15) complete and consistent with the manuscript", required: true, options: opts(["yes", "Yes"], ["no", "No, something is missing or inconsistent"]) },
          {
            id: "similarity",
            type: "radio",
            label: "Similarity (plagiarism) check",
            required: true,
            options: opts(["clear", "Checked: overlap is acceptable"], ["concern", "Checked: overlap needs an explanation or is unacceptable"], ["notRun", "Not run (explain below)"]),
          },
          { id: "similarityScore", type: "text", label: "Overall similarity and the largest single source (%)", help: "e.g. “12% overall, 3% largest source, excluding references”." },
          { id: "anonymised", type: "radio", label: "Anonymised for the journal's review model", required: true, options: opts(["yes", "Yes"], ["no", "No"], ["na", "Not applicable (open review)"]) },
          { id: "reporting", type: "radio", label: "Reporting checklist (EP-F-13) present and appropriate", required: true, options: opts(["yes", "Yes"], ["no", "No"], ["na", "Not applicable"]) },
          { id: "ethics", type: "radio", label: "Ethics approval and consent (EP-F-03) adequate for the research", required: true, options: opts(["yes", "Yes"], ["no", "No"], ["na", "Not applicable"]) },
          { id: "images", type: "radio", label: "Figures and images show no sign of inappropriate manipulation", required: true, options: opts(["yes", "Yes"], ["concern", "There is a concern"]) },
          { id: "quality", type: "radio", label: "Language, structure and references good enough for reviewers to assess", required: true, options: opts(["yes", "Yes"], ["no", "No"]) },
          { id: "notes", type: "textarea", label: "Notes on any check answered No or with a concern", maxLength: 4000 },
        ],
      },
      {
        heading: "Outcome",
        fields: [
          {
            id: "outcome",
            type: "radio",
            label: "Screening outcome",
            required: true,
            options: opts(
              ["review", "Send to peer review"],
              ["return", "Return to the authors to fix the problems above before review"],
              ["deskReject", "Reject without review (desk rejection)"],
              ["integrity", "Hold: open a research integrity record (EP-F-22)"]
            ),
          },
          { id: "reason", type: "textarea", label: "Reason, as it will be explained to the authors", required: true, showIf: { field: "outcome", in: ["return", "deskReject"] } },
          attest("independent", "My screening is based only on the manuscript and the journal's published criteria, independent of the authors' identity, institution, country or ability to pay."),
        ],
      },
    ],
    signatureStatement: "I declare that I carried out these checks myself and that this record is accurate.",
    afterSubmission: [
      "Send to peer review: the manuscript can now be sent to reviewers.",
      "Return or desk rejection: record the decision in the Workflow tab; your reason is used in the letter to the authors.",
      "Hold: open a Research Integrity Investigation Record (EP-F-22) and follow the COPE flowchart.",
    ],
    faqs: [
      { q: "Is the AI triage report enough?", a: "No. It helps you find problems, but the checks in this form are the editor's own judgement." },
      { q: "Must every editor complete this?", a: "No. It is completed once per manuscript, by the editor who screens it." },
    ],
    relatedGuides: ["guide-author-submission", "guide-publication-ethics", "guide-reviewer-handbook"],
    keywords: ["desk review checklist", "editorial screening", "initial manuscript check", "desk rejection"],
    metaDescription: "Official Eleventh Press Initial Editorial Screening Checklist (EP-F-20): the editor's recorded checks of scope, declarations, similarity, anonymisation, ethics and reporting before peer review.",
  },

  // ── EP-F-21 ─────────────────────────────────────────────────────────
  {
    id: "form-waiver-assessment",
    slug: "apc-waiver-assessment-record",
    code: "EP-F-21",
    title: "APC Waiver Assessment Record",
    role: "editor",
    audience: "Editors or staff who assess article processing charge (APC) waiver requests",
    summary: "The documented assessment of an author's APC waiver request against the published criteria, the decision (full, partial or no waiver) and its reasons, kept separate from the editorial decision.",
    purpose: "To decide waivers consistently and transparently, as Plan S and DOAJ require, and to keep ability to pay out of the editorial decision.",
    when: "Completed once for each manuscript whose authors requested a waiver at submission.",
    where: "Editorial queue → the manuscript → Forms → Assess APC waiver.",
    scope: "editor-article",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["Plan S Principles", "DOAJ", "Principles of Transparency", "COPE Core Practices"],
    standards: [
      std("planS", "Waivers for authors who cannot pay, and fees that never influence editorial decisions."),
      std("doaj", "A clearly stated waiver policy, applied consistently."),
      std("transparency", "Fees and waivers stated openly, and kept separate from editorial decisions."),
      std("cope", "Core practice on business models: editorial decisions independent of payment."),
    ],
    instructions: [
      "Assess the request against the criteria in the APC Waiver Policy only: the corresponding author's country income group, lack of funding, career stage and genuine hardship.",
      "Do not consider the quality of the manuscript. The waiver decision has no bearing on the editorial decision, and reviewers are never told of it.",
      "Give reasons the author can understand. A partial waiver states the percentage.",
    ],
    sections: [
      {
        heading: "Assessment",
        fields: [
          {
            id: "criteria",
            type: "checkboxes",
            label: "Criteria met (tick all that apply)",
            required: true,
            options: opts(
              ["lowIncome", "Corresponding author based in a low-income country (World Bank classification)"],
              ["lowerMiddle", "Corresponding author based in a lower-middle-income country"],
              ["noFunding", "The research had no funding that can pay publication costs"],
              ["earlyCareer", "Student or early-career researcher without institutional support"],
              ["hardship", "Documented financial hardship"],
              ["none", "None of the criteria is met"]
            ),
          },
          { id: "evidence", type: "textarea", label: "Evidence considered", help: "What the author provided and what you checked.", required: true, maxLength: 3000 },
        ],
      },
      {
        heading: "Decision",
        fields: [
          {
            id: "decision",
            type: "radio",
            label: "Decision",
            required: true,
            options: opts(["full", "Full waiver (100%)"], ["partial", "Partial waiver"], ["deny", "No waiver"]),
          },
          { id: "percentage", type: "text", label: "Percentage waived", placeholder: "e.g. 50", required: true, showIf: { field: "decision", in: ["partial"] }, maxLength: 3 },
          { id: "reasons", type: "textarea", label: "Reasons, as they will be sent to the author", required: true, maxLength: 3000 },
          attest("separate", "This decision was made only on the waiver criteria, and has not influenced, and will not influence, the editorial decision on the manuscript."),
        ],
      },
    ],
    signatureStatement: "I declare that this assessment was made fairly and in line with the published APC Waiver Policy.",
    afterSubmission: [
      "The waiver status on the manuscript is updated, and the author is told the decision and the reasons.",
      "The record is visible to editors only. Reviewers never see it.",
      "The fee, if any, is invoiced only after acceptance.",
    ],
    faqs: [
      { q: "Can the handling editor assess the waiver?", a: "They may, but the decision must be made only on the waiver criteria. Where possible, another editor or staff member assesses it." },
      { q: "Can a waiver be reconsidered?", a: "Yes. If the author's circumstances change, they can ask the editorial office, and a new record is completed." },
    ],
    relatedGuides: ["guide-apc-waiver"],
    keywords: ["APC waiver assessment", "article processing charge waiver", "fee waiver decision", "Plan S waiver"],
    metaDescription: "Official Eleventh Press APC Waiver Assessment Record (EP-F-21): criteria, evidence and the full, partial or no-waiver decision, kept separate from the editorial decision.",
  },

  // ── EP-F-22 ─────────────────────────────────────────────────────────
  {
    id: "form-integrity-record",
    slug: "research-integrity-investigation-record",
    code: "EP-F-22",
    title: "Research Integrity Investigation Record",
    role: "editor",
    audience: "Editors handling a concern about a manuscript or published article",
    summary: "The confidential record of a research-integrity concern: what was alleged and by whom, the COPE flowchart followed, the authors' response, any institutional referral, and the outcome.",
    purpose: "To handle every concern about plagiarism, fabrication, falsification, image manipulation, authorship, duplicate publication, undisclosed interests or reviewer misconduct consistently, fairly to the authors, and on the record.",
    when: "Opened when a concern is raised about a manuscript or published article, and updated (as a new record) at each stage until it is closed.",
    where: "Editorial queue → the manuscript → Forms → Integrity record.",
    scope: "editor-article",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "COPE Flowcharts", "COPE Retraction Guidelines", "ICMJE Recommendations"],
    standards: [
      std("cope", "Core practice on allegations of misconduct: a documented process, followed in every case."),
      std("copeFlowcharts", "The step-by-step flowcharts for each type of concern."),
      std("copeRetraction", "When a concern leads to a retraction or an expression of concern."),
      std("icmje", "Editors' obligation to pursue concerns and to contact institutions when needed."),
    ],
    instructions: [
      "Open a record as soon as a concern is raised. Do not contact the whistleblower's subject until you have looked at the evidence.",
      "Follow the COPE flowchart for the type of concern, and record each step.",
      "Give the authors a fair chance to respond before reaching a conclusion.",
      "Keep the identity of anyone who raised the concern confidential unless they agree otherwise.",
      "Each stage is a new record. The latest record shows the current status.",
    ],
    sections: [
      {
        heading: "The concern",
        fields: [
          {
            id: "concernType",
            type: "checkboxes",
            label: "Type of concern (tick all that apply)",
            required: true,
            options: opts(
              ["plagiarism", "Plagiarism or text recycling"],
              ["fabrication", "Fabricated or falsified data"],
              ["images", "Image manipulation"],
              ["duplicate", "Duplicate or redundant publication"],
              ["authorship", "Authorship dispute, gift or ghost authorship"],
              ["coi", "Undisclosed competing interest"],
              ["ethics", "Missing ethics approval or consent"],
              ["review", "Peer-review manipulation or reviewer misconduct"],
              ["papermill", "Suspected paper mill or citation manipulation"],
              ["other", "Other"]
            ),
          },
          {
            id: "source",
            type: "radio",
            label: "How the concern was raised",
            required: true,
            options: opts(["reviewer", "By a reviewer"], ["editor", "By an editor or the screening checks"], ["reader", "By a reader (EP-F-24)"], ["author", "By an author"], ["institution", "By an institution or funder"], ["anonymous", "Anonymously"]),
          },
          { id: "receivedOn", type: "date", label: "Date the concern was received", required: true },
          { id: "summary", type: "textarea", label: "Summary of the concern and the evidence", required: true, maxLength: 8000 },
        ],
      },
      {
        heading: "Steps taken",
        fields: [
          { id: "flowchart", type: "text", label: "COPE flowchart followed", placeholder: "e.g. “Suspected plagiarism in a submitted manuscript”", required: true },
          {
            id: "steps",
            type: "checkboxes",
            label: "Steps completed so far",
            required: true,
            options: opts(
              ["evidence", "Evidence reviewed and documented"],
              ["authorsContacted", "Authors contacted for an explanation"],
              ["responseReceived", "Authors' response received"],
              ["expert", "Independent expert opinion obtained"],
              ["institution", "Referred to the authors' institution"],
              ["paused", "Peer review or publication paused"]
            ),
          },
          { id: "response", type: "textarea", label: "Summary of the authors' response", maxLength: 6000 },
        ],
      },
      {
        heading: "Status and outcome",
        fields: [
          {
            id: "outcome",
            type: "radio",
            label: "Status",
            required: true,
            options: opts(
              ["open", "Open: investigation continuing"],
              ["noAction", "Closed: no misconduct found, no action"],
              ["education", "Closed: minor issue, authors advised"],
              ["correction", "Closed: correction required"],
              ["eoc", "Closed: expression of concern"],
              ["retraction", "Closed: retraction"],
              ["rejected", "Closed: manuscript rejected"]
            ),
          },
          { id: "rationale", type: "textarea", label: "Reasons for the outcome, or next steps", required: true, maxLength: 6000 },
          attest("fairness", "The authors have been, or will be, given a fair opportunity to respond before any conclusion is reached, and the whistleblower's identity is protected."),
        ],
      },
    ],
    signatureStatement: "I declare that this record is accurate and complete at the date of signing.",
    afterSubmission: [
      "The record is confidential to the editors, and kept with the manuscript.",
      "A correction, expression of concern or retraction is published following the Corrections & Retractions Policy.",
      "Each later stage is recorded as a new record, so the full history is kept.",
    ],
    faqs: [
      { q: "Do I tell the authors who raised the concern?", a: "No, unless the person agrees. Present the evidence, not the source." },
      { q: "What if the authors don't reply?", a: "Follow the COPE flowchart: after reasonable reminders, contact their institution. Record each attempt." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-corrections-retractions"],
    keywords: ["research integrity investigation", "misconduct allegation record", "COPE flowchart", "editor investigation"],
    metaDescription: "Official Eleventh Press Research Integrity Investigation Record (EP-F-22): the confidential, step-by-step record of a misconduct concern, the COPE flowchart followed and the outcome.",
  },

  // ── EP-F-23 ─────────────────────────────────────────────────────────
  {
    id: "form-complaint",
    slug: "complaint-form",
    code: "EP-F-23",
    title: "Complaint Form",
    role: "public",
    audience: "Anyone: authors, reviewers, editors, readers and institutions",
    summary: "A formal complaint about how a manuscript, review or request was handled, about the conduct of an editor, reviewer or staff member, or about the journal's policies, with the outcome sought.",
    purpose: "To give everyone a clear, published route to complain and to have the complaint handled fairly, on time and by someone not involved, as COPE and DOAJ require.",
    when: "At any time. Appeals against a rejection use EP-F-11 instead.",
    where: "On this page (sign in or not), or from Dashboard → Official forms.",
    scope: "public",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "Principles of Transparency", "DOAJ"],
    standards: [
      std("cope", "Core practice on complaints and appeals: a clear process, handled promptly by someone not involved."),
      std("transparency", "A published complaints process."),
      std("doaj", "Journals have a complaints policy and act on it."),
    ],
    instructions: [
      "Say what happened, when, and who was involved, and include any reference number or manuscript title.",
      "A complaint about an editor is handled by a different editor or by the publisher.",
      "To appeal a rejection, use the Appeal of an Editorial Decision (EP-F-11) from My Articles.",
      "To report a concern about the integrity of a published article, use Report a Concern (EP-F-24).",
    ],
    sections: [
      {
        heading: "Your details",
        fields: [
          { id: "contactEmail", type: "email", label: "Your email address", help: "We reply to this address.", required: true },
          {
            id: "capacity",
            type: "radio",
            label: "You are",
            required: true,
            options: opts(["author", "An author"], ["reviewer", "A reviewer"], ["editor", "An editor or board member"], ["reader", "A reader"], ["institution", "Representing an institution or funder"], ["other", "Other"]),
          },
        ],
      },
      {
        heading: "Your complaint",
        fields: [
          {
            id: "about",
            type: "radio",
            label: "The complaint is about",
            required: true,
            options: opts(
              ["handling", "How a manuscript, review or request was handled (delays, communication, process)"],
              ["editor", "The conduct of an editor"],
              ["reviewer", "The conduct of a reviewer"],
              ["staff", "The editorial office or platform staff"],
              ["policy", "A journal policy, fee or the platform"],
              ["other", "Something else"]
            ),
          },
          { id: "articleRef", type: "text", label: "Manuscript title, DOI or reference (if any)" },
          { id: "personNamed", type: "text", label: "Person the complaint is about (if any)", showIf: { field: "about", in: ["editor", "reviewer", "staff"] } },
          { id: "details", type: "textarea", label: "What happened", help: "Facts, dates and the people involved. Include any earlier correspondence.", required: true, maxLength: 10000 },
          { id: "outcome", type: "textarea", label: "What outcome are you seeking?", required: true, maxLength: 3000 },
        ],
      },
      {
        heading: "Acknowledgements",
        fields: [
          attest("goodFaith", "The information in this complaint is accurate to the best of my knowledge, and is made in good faith."),
          attest("process", "I understand that the complaint is acknowledged within 5 working days, handled by someone not involved, and answered in writing, normally within 30 days."),
          attest("privacy", "I agree that the details I give are used only to handle this complaint, under the Privacy Policy."),
        ],
      },
    ],
    signatureStatement: "I declare that this complaint is made in good faith and is accurate to the best of my knowledge.",
    afterSubmission: [
      "You receive an acknowledgement at once, with a reference number.",
      "The complaint is handled by an editor or publisher representative who was not involved in what you describe.",
      "You receive a written outcome, normally within 30 days. If you remain dissatisfied, you may take the complaint to COPE.",
    ],
    faqs: [
      { q: "Can I complain about an editor?", a: "Yes. The complaint is handled by a different editor or by the publisher, never by the editor named." },
      { q: "What if I am not satisfied with the outcome?", a: "You can ask for it to be reviewed by the publisher. For members' journals, COPE also considers complaints that a journal has not followed its guidance." },
    ],
    relatedGuides: ["guide-publication-ethics"],
    keywords: ["journal complaint form", "complain about editor", "publication complaint", "COPE complaints"],
    metaDescription: "Official Eleventh Press Complaint Form (EP-F-23): complaints about manuscript handling, editors, reviewers, staff or policies, handled by someone not involved.",
  },

  // ── EP-F-24 ─────────────────────────────────────────────────────────
  {
    id: "form-report-concern",
    slug: "report-a-concern-about-a-published-article",
    code: "EP-F-24",
    title: "Report a Concern About an Article",
    role: "public",
    audience: "Anyone, including anonymously",
    summary: "A report of a possible research-integrity problem in a published article or manuscript (plagiarism, data or image problems, duplicate publication, authorship, undisclosed interests or ethics), with the evidence, and anonymously if you prefer.",
    purpose: "To let anyone raise a concern safely and have it investigated under the COPE flowcharts, with the whistleblower protected.",
    when: "At any time.",
    where: "On this page (sign in or not, named or anonymous).",
    scope: "public",
    anonymousIf: { field: "anonymous", in: ["yes"] },
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Core Practices", "COPE Flowcharts", "COPE Retraction Guidelines"],
    standards: [
      std("cope", "Core practice on allegations of misconduct, including anonymous ones, and protection of whistleblowers."),
      std("copeFlowcharts", "How each type of concern is investigated."),
      std("copeRetraction", "The possible outcomes: correction, expression of concern or retraction."),
    ],
    instructions: [
      "Identify the article by its DOI or title, and say exactly where the problem is (page, figure, table or paragraph).",
      "Give the evidence: links to the overlapping source, the figure panels that look duplicated, the data that don't add up.",
      "Anonymous reports are investigated if the evidence is specific enough, but we cannot ask you questions or tell you the outcome.",
      "Report facts, not accusations. The authors are presumed to have acted in good faith until the investigation is complete.",
    ],
    sections: [
      {
        heading: "About you",
        fields: [
          {
            id: "anonymous",
            type: "radio",
            label: "Do you want to report anonymously?",
            required: true,
            options: opts(["no", "No. You may contact me, and my identity is kept confidential"], ["yes", "Yes, report anonymously (we cannot reply to you)"]),
          },
          { id: "contactEmail", type: "email", label: "Your email address", required: true, showIf: { field: "anonymous", in: ["no"] } },
          { id: "interest", type: "textarea", label: "Any competing interest you have in reporting this (optional)", help: "For example, a dispute with the authors or competing research.", showIf: { field: "anonymous", in: ["no"] } },
        ],
      },
      {
        heading: "The article and the concern",
        fields: [
          { id: "articleRef", type: "text", label: "DOI, URL or title of the article", required: true },
          {
            id: "concernType",
            type: "checkboxes",
            label: "Type of concern (tick all that apply)",
            required: true,
            options: opts(
              ["plagiarism", "Plagiarism or text recycling"],
              ["data", "Data that appear fabricated, falsified or wrong"],
              ["images", "Images that appear duplicated or manipulated"],
              ["duplicate", "Duplicate publication"],
              ["authorship", "Authorship (missing, gift or ghost authors)"],
              ["coi", "Undisclosed competing interests or funding"],
              ["ethics", "Missing ethics approval or consent"],
              ["papermill", "Signs of a paper mill or citation manipulation"],
              ["other", "Other"]
            ),
          },
          { id: "location", type: "text", label: "Where in the article (page, figure, table, section)", required: true },
          { id: "evidence", type: "textarea", label: "Your concern and the evidence", help: "Be specific. Include links to sources and describe what you compared.", required: true, maxLength: 10000 },
        ],
      },
      {
        heading: "Acknowledgements",
        fields: [
          attest("goodFaith", "I make this report in good faith, and the information is accurate to the best of my knowledge."),
          attest("confidential", "I understand that the report is confidential, and that the outcome is published (as a correction, expression of concern or retraction) only if one is needed."),
        ],
      },
    ],
    signatureStatement: "I declare that this report is made in good faith.",
    afterSubmission: [
      "The editors open a Research Integrity Investigation Record (EP-F-22) and follow the COPE flowchart for the concern.",
      "Named reporters receive an acknowledgement and, where possible, are told when the matter is closed.",
      "Your identity is never shared with the authors without your consent.",
    ],
    faqs: [
      { q: "Will the authors know I reported them?", a: "No. Your identity is confidential, and we present the evidence, not its source." },
      { q: "Do you investigate anonymous reports?", a: "Yes, when the evidence is specific and verifiable. We cannot reply to you or ask you questions." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-corrections-retractions"],
    keywords: ["report research misconduct", "report concern article", "whistleblower journal", "image duplication report", "anonymous misconduct report"],
    metaDescription: "Official Eleventh Press Report a Concern About an Article (EP-F-24): report plagiarism, data or image problems, authorship or ethics concerns, named or anonymously.",
  },

  // ── EP-F-25 ─────────────────────────────────────────────────────────
  {
    id: "form-correction-request",
    slug: "correction-request-form",
    code: "EP-F-25",
    title: "Correction Request",
    role: "public",
    audience: "Authors of a published article, and readers who find an error",
    summary: "A request to correct an error in a published article: what is wrong, where, the correct text, whether it changes the results or conclusions, and, for authors, the agreement of every author.",
    purpose: "To correct the scholarly record promptly and transparently, with a linked correction notice registered with Crossref, as the Corrections & Retractions Policy and COPE require.",
    when: "At any time after publication.",
    where: "On this page, or from Dashboard → Official forms.",
    scope: "public",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["COPE Retraction Guidelines", "Crossref Crossmark", "ICMJE Recommendations"],
    standards: [
      std("copeRetraction", "When an error calls for a correction, and when for an expression of concern or retraction."),
      std("crossmark", "Correction notices linked to the article and registered so readers are alerted."),
      std("icmje", "Corrections published as soon as possible, on a citable page, linked to the original."),
    ],
    instructions: [
      "Identify the article and quote the incorrect text exactly, with its location.",
      "Give the correct text as it should appear in the notice.",
      "Say honestly whether the error affects the results or conclusions. A serious error may need an expression of concern or a retraction instead.",
      "Authors: confirm that every author agrees. Readers: the editor contacts the authors.",
    ],
    sections: [
      {
        heading: "Your details",
        fields: [
          { id: "contactEmail", type: "email", label: "Your email address", required: true },
          { id: "capacity", type: "radio", label: "You are", required: true, options: opts(["author", "An author of the article"], ["reader", "A reader"]) },
        ],
      },
      {
        heading: "The error",
        fields: [
          { id: "articleRef", type: "text", label: "DOI, URL or title of the article", required: true },
          {
            id: "errorType",
            type: "radio",
            label: "Type of error",
            required: true,
            options: opts(
              ["typo", "A typographical or formatting error"],
              ["author", "An author's name, affiliation, ORCID iD or contribution"],
              ["funding", "Funding, competing interests or acknowledgements"],
              ["figure", "A figure, table or its legend"],
              ["data", "A number, result or calculation"],
              ["reference", "A reference or citation"],
              ["other", "Other"]
            ),
          },
          { id: "location", type: "text", label: "Where (page, section, figure or table)", required: true },
          { id: "incorrect", type: "textarea", label: "What it says now", required: true, maxLength: 4000 },
          { id: "correct", type: "textarea", label: "What it should say", required: true, maxLength: 4000 },
          {
            id: "impact",
            type: "radio",
            label: "Does the error change the results or conclusions?",
            required: true,
            options: opts(["no", "No"], ["partly", "It changes a result but not the main conclusions"], ["yes", "Yes, it changes the main conclusions"]),
          },
        ],
      },
      {
        heading: "Declarations",
        fields: [
          attest("coauthors", "Every author of the article has been told of this request and agrees to it.", { showIf: { field: "capacity", in: ["author"] } }),
          attest("accurate", "The information in this request is accurate to the best of my knowledge."),
        ],
      },
    ],
    signatureStatement: "I declare that this request is accurate and made in good faith.",
    afterSubmission: [
      "The editors check the request and, for a reader's request, ask the authors.",
      "If a correction is needed, a correction notice is published, linked to the article and registered with Crossref, and the article is updated.",
      "You are told the outcome in writing.",
    ],
    faqs: [
      { q: "Will the article be changed silently?", a: "No. Every change after publication is made through a published, linked correction notice." },
      { q: "The error invalidates our conclusions.", a: "Say so under “Does the error change the conclusions?”. The editor may recommend a retraction, which authors can also request." },
    ],
    relatedGuides: ["guide-corrections-retractions", "guide-publication-ethics"],
    keywords: ["correction request", "erratum request", "corrigendum", "correct published article"],
    metaDescription: "Official Eleventh Press Correction Request (EP-F-25): request a correction to a published article, with the error, the correct text and its effect on the conclusions.",
  },

  // ── EP-F-26 ─────────────────────────────────────────────────────────
  {
    id: "form-privacy-request",
    slug: "data-privacy-request-form",
    code: "EP-F-26",
    title: "Data Privacy Request",
    role: "public",
    audience: "Anyone whose personal data Eleventh Press holds: authors, reviewers, editors, readers and research participants",
    summary: "A request to exercise your rights as a data subject under the Data Privacy Act of 2012: to be informed, to access, correct, erase or block your data, to object, to data portability, or to withdraw consent.",
    purpose: "To let data subjects exercise their rights simply, and to make sure every request is recorded, verified and answered within the time the law allows.",
    when: "At any time.",
    where: "On this page, or from Dashboard → Official forms. To delete your account immediately, use Settings → Delete account.",
    scope: "public",
    version: VERSION,
    effective: FORMS_EFFECTIVE,
    nextReview: NEXT_REVIEW,
    benchmarks: ["Data Privacy Act of 2012", "NPC Circulars", "COPE Core Practices"],
    standards: [
      std("dpa", "The rights of data subjects (Sections 16 to 18) and the controller's duty to respond."),
      std("npc", "How personal information controllers handle data subject requests."),
      std("cope", "Core practice on data and reproducibility: published research records are kept intact."),
    ],
    instructions: [
      "Use the email address registered on your account, if you have one, so that we can verify your identity.",
      "Say which data and which right. We may ask for proof of identity before we act.",
      "Published articles, reviews and editorial records form part of the scholarly record and are usually kept, but your account and other personal data can be erased.",
      "We respond within 30 days.",
    ],
    sections: [
      {
        heading: "Your details",
        fields: [
          { id: "contactEmail", type: "email", label: "Your email address", help: "The one on your account, if you have one.", required: true },
          {
            id: "relationship",
            type: "radio",
            label: "Your relationship with the journal",
            required: true,
            options: opts(["account", "I have an account (author, reviewer, editor or reader)"], ["participant", "I am a participant in research published here"], ["subscriber", "I receive newsletters or alerts"], ["other", "Other"]),
          },
        ],
      },
      {
        heading: "Your request",
        fields: [
          {
            id: "rights",
            type: "checkboxes",
            label: "The rights you wish to exercise (tick all that apply)",
            required: true,
            options: opts(
              ["informed", "To be informed about how my data are processed"],
              ["access", "To access a copy of my personal data"],
              ["rectify", "To correct inaccurate or incomplete data"],
              ["erase", "To erase or block my data"],
              ["object", "To object to processing, including for marketing"],
              ["portability", "To receive my data in a portable format"],
              ["withdraw", "To withdraw my consent"]
            ),
          },
          { id: "details", type: "textarea", label: "Details of your request", help: "Which data, and what you would like us to do.", required: true, maxLength: 6000 },
        ],
      },
      {
        heading: "Declarations",
        fields: [
          attest("own", "I am the person the data relate to, or I am authorised to act for them."),
          attest("verify", "I understand that my identity may be verified before the request is carried out."),
          attest("record", "I understand that published scholarly records may be kept where the law allows, and that I will be told if any part of my request cannot be met, and why."),
        ],
      },
    ],
    signatureStatement: "I declare that I am entitled to make this request and that the information in it is accurate.",
    afterSubmission: [
      "The Data Protection Officer acknowledges the request and verifies your identity.",
      "The request is carried out, or you are told which part cannot be met and why, within 30 days.",
      "If you are not satisfied, you may complain to the National Privacy Commission.",
    ],
    faqs: [
      { q: "Can you delete an article I published?", a: "Published articles are part of the permanent scholarly record and are not deleted. Personal data outside them, such as your account, can be." },
      { q: "Is there a fee?", a: "No. Data privacy requests are free." },
    ],
    relatedGuides: ["guide-publication-ethics"],
    keywords: ["data privacy request", "data subject access request", "right to erasure", "Data Privacy Act request"],
    metaDescription: "Official Eleventh Press Data Privacy Request (EP-F-26): exercise your Data Privacy Act rights to access, correct, erase or port your personal data.",
  },
];

/** The forms completed as part of the manuscript submission form, in order. */
export const SUBMISSION_FORM_IDS = [
  "form-author-declaration",
  "form-author-coi",
  "form-ethics-consent",
  "form-ai-disclosure",
  "form-licence-to-publish",
  "form-reporting-guideline",
  "form-third-party-permissions",
  "form-reviewer-suggestions",
] as const;
