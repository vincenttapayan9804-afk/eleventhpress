import { DOI_REGISTRAR, JOURNAL_IDENTITY } from "@/lib/site";
import type { GuideDoc } from "@/lib/resources/types";

/**
 * Full text of the official Eleventh Press guides. Each guide is rendered in
 * two places from this one source:
 *
 * - the crawlable /resources/guides/[slug] page;
 * - its branded PDF edition, /resources/guides/[slug]/pdf
 *   (src/lib/guide-pdf.ts).
 *
 * Catalog fields (code, title, version, effective date) live in
 * src/lib/resources-content.ts and are merged in by getGuideDoc().
 *
 * Text must stay inside the WinAnsi character set, because the PDF uses
 * PDFKit's standard fonts. That allows curly quotes, en and em dashes and
 * Latin-1 accents, but not arrows, maths symbols or check marks.
 * guide-pdf.test.ts enforces this.
 *
 * "Benchmarked standards" name the external standard each guide is
 * aligned with and how it applies it. "Aligned with" is not a claim of
 * membership or certification.
 */
const J = JOURNAL_IDENTITY;

export const GUIDE_DOCS: Record<string, GuideDoc> = {
  "guide-author-submission": {
    id: "guide-author-submission",
    audience: "Authors and corresponding authors preparing a research article for submission.",
    purpose:
      "To set out everything an author needs before, during and after submitting a manuscript to Eleventh Press, so that submissions are complete, ethically sound and ready for anonymised peer review on first upload.",
    scope:
      "Applies to all research articles, reviews and expert insights submitted to Eleventh Press across its twelve disciplines. Book proposals follow the same principles but are submitted through the book division.",
    metaDescription:
      "Official Eleventh Press author submission guide: manuscript components, metadata, authorship and CRediT roles, declarations, anonymisation, review models, fees and every stage after submission.",
    keywords: ["author guidelines", "manuscript submission", "submission checklist", "CRediT", "ORCID", "data availability statement", "conflict of interest", "double-blind review", "open access journal", "ICMJE"],
    keyPoints: [
      "Submit only original work that is not published or under consideration elsewhere.",
      "Upload the manuscript as PDF, DOCX, DOC, LaTeX (.tex), Markdown, HTML or plain text.",
      "Provide a title, an abstract, three to eight keywords and one of the twelve discipline tags.",
      "List every author with affiliation and email; add ORCID iDs, ROR IDs and CRediT roles wherever possible.",
      "Every listed author must meet the ICMJE authorship criteria; others are acknowledged.",
      "A conflict-of-interest declaration and a data availability statement are mandatory, even if the answer is “none” or “not applicable”.",
      "Confirm the rights-retention statement: you keep the right to share the accepted manuscript under CC BY 4.0.",
      "Anonymise the manuscript file for double-blind review, which is the default model.",
      "Disclose any use of generative AI tools; AI tools cannot be listed as authors.",
      `There is no submission fee; the ${J.apc} APC is invoiced only after acceptance, and waivers are available.`,
    ],
    standards: [
      {
        name: "ICMJE Recommendations",
        issuer: "International Committee of Medical Journal Editors",
        edition: "Current edition (updated periodically)",
        url: "https://www.icmje.org/recommendations/",
        application: "Defines who qualifies as an author, the disclosure of competing interests, and the use of AI-assisted technologies, applied across all disciplines.",
      },
      {
        name: "COPE Core Practices",
        issuer: "Committee on Publication Ethics",
        edition: "2017",
        url: "https://publicationethics.org/core-practices",
        application: "Frames the submission requirements for authorship, conflicts of interest, data and reproducibility, and ethical oversight.",
      },
      {
        name: "CRediT Contributor Roles Taxonomy",
        issuer: "NISO",
        edition: "ANSI/NISO Z39.104-2022",
        url: "https://credit.niso.org/",
        application: "The 14 standard roles authors can assign to each contributor at submission; published with the article.",
      },
      {
        name: "EQUATOR Network reporting guidelines",
        issuer: "EQUATOR Network",
        edition: "Library, current",
        url: "https://www.equator-network.org/",
        application: "Authors report each study design to its guideline (e.g. CONSORT, PRISMA 2020, STROBE, COREQ, ARRIVE 2.0) and state which they followed.",
      },
      {
        name: "ORCID and ROR persistent identifiers",
        issuer: "ORCID; Research Organization Registry",
        edition: "Current",
        url: "https://orcid.org/",
        application: "Unambiguous identification of authors and their institutions in the published metadata.",
      },
      {
        name: "Declaration of Helsinki",
        issuer: "World Medical Association",
        edition: "2024 revision",
        url: "https://www.wma.net/policies-post/wma-declaration-of-helsinki/",
        application: "Ethical basis for research involving human participants, identifiable data or human material.",
      },
    ],
    sections: [
      {
        heading: "Before you submit",
        paragraphs: [
          `${J.name} publishes peer-reviewed open-access research across twelve disciplines: Physics, Biology, Computer Science, Sociology, Economics, Psychology, Environmental Science, Mathematics, Education, Business, Technology, and Language and Literature. We particularly welcome work that crosses disciplinary boundaries.`,
          "Before submitting, confirm that the manuscript is original, that it has not been published elsewhere (a preprint does not count as prior publication, but must be declared), that it is not under consideration by another journal, and that every author has seen and approved the final version and agreed to its submission.",
        ],
      },
      {
        heading: "Manuscript file and accepted formats",
        paragraphs: [
          "Upload a single manuscript file in PDF, DOCX, DOC, LaTeX (.tex), Markdown, HTML or plain-text format. There is no rigid template at submission: concentrate on clarity and completeness. Accepted manuscripts are typeset into house style during production (see EP-G-02, the Formatting & Citation Style Guide).",
          "A typical research article contains the following elements, in this order:",
        ],
        bullets: [
          "Title: specific and informative; avoid abbreviations.",
          "Abstract: a structured or unstructured summary of the question, methods, principal results and conclusions; we recommend 150 to 300 words.",
          "Main text: usually introduction, methods, results and discussion, or the conventional structure of your field.",
          "Declarations: funding, conflicts of interest, ethics approval and consent, data and code availability, and use of AI tools.",
          "References: complete and consistently formatted, with DOIs wherever they exist.",
          "Figures and tables: numbered in order of first citation, each with a self-contained caption.",
        ],
      },
      {
        heading: "Metadata entered at submission",
        paragraphs: [
          "The submission form asks for metadata that drives reviewer matching, indexing and discovery, so it is worth completing carefully. Enter the title and abstract exactly as they appear in the manuscript, choose the discipline tag that best describes the work (the most relevant one, for cross-field work), and provide three to eight keywords that describe the methods as well as the topic.",
          "Funding information should name each funder, ideally with its Open Funder Registry or ROR identifier and the award number, because funders use this metadata to track the outputs of their grants.",
        ],
      },
      {
        heading: "Authorship and contributor roles",
        paragraphs: [
          "Eleventh Press follows the ICMJE authorship criteria across all disciplines. Every listed author must have (1) made substantial contributions to the conception or design of the work, or to the acquisition, analysis or interpretation of data; (2) drafted the work or revised it critically for important intellectual content; (3) approved the final version; and (4) agreed to be accountable for all aspects of the work. People who contributed but do not meet all four criteria are acknowledged instead.",
          "For each author, provide a name, affiliation and email address; we strongly encourage ORCID iDs and ROR identifiers for affiliations. You can also assign CRediT contributor roles (ANSI/NISO Z39.104-2022) to each author, such as Conceptualization, Methodology, Formal analysis or Writing – review & editing. These roles are published with the article and make each person's contribution transparent.",
          "Changes to the author list after submission require the written agreement of all authors and the approval of the handling editor. Authorship disputes are resolved before publication.",
        ],
      },
      {
        heading: "Mandatory declarations",
        paragraphs: ["Four declarations are required for every submission. “None” or “not applicable” are acceptable answers where true, but an answer must be given."],
        bullets: [
          "Conflicts of interest: any financial, professional, personal or intellectual interest that could be perceived as influencing the work, for every author.",
          "Data availability statement: where the data and code underlying the results can be found and under what conditions (see EP-G-05).",
          "Rights-retention statement: confirmation that you retain the right to make the accepted manuscript publicly available under CC BY 4.0 regardless of any other agreement, consistent with Plan S and similar funder policies.",
          "Ethics: for research involving human participants, identifiable personal data or animals, the name of the approving ethics committee or review board, the approval reference and a statement on informed consent, or an explanation of why approval was not required.",
        ],
        after:
          "Disclose the use of generative AI tools in writing, analysis or figure preparation in the methods or acknowledgements, stating the tool and its purpose. AI tools cannot be authors, because they cannot take responsibility for the work. Authors remain accountable for the accuracy and integrity of all content, including any produced with AI assistance.",
      },
      {
        heading: "Choosing a review model and anonymising your manuscript",
        paragraphs: [
          "Double-blind (double-anonymised) review is the default. You may choose single-anonymised or open review at submission where your field's norms make blinding impractical, and you may opt in to open peer review, in which reports are published with the article.",
          "For double-blind review, remove from the manuscript file all author names, affiliations and contact details; acknowledgements and funding statements (enter these in the form instead); self-identifying phrases such as “in our previous work”, rewriting them in the third person; identifying institutional names in the methods; and author and organisation fields in the document properties. Self-citations themselves should remain.",
        ],
      },
      {
        heading: "What happens after you submit",
        paragraphs: ["You can follow every stage from the My Articles tab of your dashboard. A typical manuscript passes through the following stages:"],
        bullets: [
          "Initial editorial screening for scope, completeness and adherence to this guide.",
          "Automated in-corpus similarity check before the manuscript reaches any reviewer.",
          "Anonymisation and assignment to discipline-matched reviewers, usually two or three.",
          "Peer review: reviewers have 14 days from accepting an invitation.",
          "Editorial decision: accept, minor revisions, major revisions or reject, with the reviewers' comments.",
          "Revision, if requested, with a point-by-point response to the reviewers.",
          `Acceptance, APC invoice (or approved waiver), production, citation validation against OpenAlex, DOI registration with ${DOI_REGISTRAR} and publication under CC BY 4.0.`,
        ],
      },
      {
        heading: "Fees",
        paragraphs: [
          `There is no submission fee. The article processing charge of ${J.apc} is invoiced once, after acceptance, and is never a condition of review. Full and partial waivers are available; request one in the submission form (or later by email), and requests never influence the editorial decision (see EP-G-04).`,
        ],
      },
    ],
    checklist: [
      "The manuscript is original and not under consideration elsewhere; any preprint is declared.",
      "All authors meet the ICMJE criteria and have approved the submission.",
      "Title, abstract, three to eight keywords and discipline tag are entered.",
      "Every author has a name, affiliation and email; ORCID iDs and ROR IDs are added where available.",
      "CRediT roles are assigned to each author (recommended).",
      "Funders and award numbers are listed.",
      "Conflict-of-interest declaration is complete for every author.",
      "Data availability statement is complete.",
      "Ethics approval and consent are reported, or their absence is explained.",
      "Use of generative AI tools is disclosed.",
      "The rights-retention statement is confirmed.",
      "The manuscript file is anonymised, including its document properties.",
      "The relevant reporting guideline has been followed and is named in the methods.",
    ],
    faqs: [
      { q: "Is there a fee to submit?", a: `No. The ${J.apc} APC is invoiced only after acceptance, and waivers are available.` },
      { q: "Can I submit a manuscript that has been posted as a preprint?", a: "Yes. Declare the preprint and its DOI or URL at submission. A preprint is not considered prior publication." },
      { q: "Which file format should I use?", a: "Any of PDF, DOCX, DOC, LaTeX (.tex), Markdown, HTML or plain text. Clarity matters more than format; we typeset accepted manuscripts into house style." },
      { q: "Can generative AI be listed as an author?", a: "No. AI tools cannot take responsibility for the work. Disclose any use and the purpose; the human authors remain accountable for all content." },
      { q: "How long does review take?", a: "Reviewers have 14 days from accepting an invitation. Total time to first decision depends on how quickly suitable reviewers accept, and you can follow every stage in your dashboard." },
    ],
    relatedGuides: ["guide-formatting-citation", "guide-publication-ethics", "guide-data-code-availability"],
  },

  "guide-formatting-citation": {
    id: "guide-formatting-citation",
    audience: "Authors preparing a manuscript, and authors checking proofs of an accepted article.",
    purpose:
      "To describe the structure, house style and reference conventions that make a manuscript easy to review and quick to produce, and to explain how an accepted manuscript becomes a typeset PDF, HTML and JATS XML article.",
    scope: "Applies to all manuscripts at submission and production. Discipline-specific conventions (for example, legal citation or mathematical notation) are respected where they are consistent and complete.",
    metaDescription:
      "Official Eleventh Press formatting and citation style guide: manuscript structure, APA 7 references with DOIs, figures, tables, SI units, ISO 8601 dates, accessibility and JATS production.",
    keywords: ["manuscript formatting", "citation style", "APA 7", "reference list", "DOI", "figure guidelines", "JATS XML", "SI units", "alt text", "house style"],
    keyPoints: [
      "There is no rigid template at submission: clarity and completeness come first.",
      "References may use any complete, consistent style at submission; house style follows APA 7th edition author–date conventions.",
      "Every reference needs the full author list, title, venue, year and, wherever one exists, a DOI.",
      "Write DOIs as resolvable URLs: https://doi.org/10.xxxx/xxxxx.",
      "DOIs in the reference list are validated against OpenAlex at production.",
      "Cite figures and tables in order, each with a self-contained caption.",
      "Supply alternative text for every figure, and do not rely on colour alone to convey meaning.",
      "Use SI units, ISO 8601 dates and define every abbreviation at first use.",
      "Cite datasets and software in the reference list, as you would articles.",
      "Accepted manuscripts are typeset into PDF, HTML and JATS XML; answer production queries promptly, as changes after publication require a formal correction.",
    ],
    standards: [
      {
        name: "Publication Manual of the American Psychological Association",
        issuer: "American Psychological Association",
        edition: "7th edition (2020)",
        url: "https://apastyle.apa.org/",
        application: "House reference style for author–date citations and the reference list, and the format of the recommended citation printed on each article.",
      },
      {
        name: "JATS: Journal Article Tag Suite",
        issuer: "NISO",
        edition: "ANSI/NISO Z39.96 (JATS 1.3)",
        url: "https://jats.nlm.nih.gov/",
        application: "XML standard into which accepted articles are converted for archiving, indexing and machine reading.",
      },
      {
        name: "The International System of Units (SI Brochure)",
        issuer: "Bureau International des Poids et Mesures",
        edition: "9th edition (2019)",
        url: "https://www.bipm.org/en/publications/si-brochure",
        application: "Units, symbols and number formatting in all quantitative work.",
      },
      {
        name: "ISO 8601 Date and time format",
        issuer: "International Organization for Standardization",
        edition: "ISO 8601-1:2019",
        url: "https://www.iso.org/iso-8601-date-and-time-format.html",
        application: "Unambiguous dates in data, tables and supplementary material (YYYY-MM-DD).",
      },
      {
        name: "Web Content Accessibility Guidelines",
        issuer: "World Wide Web Consortium",
        edition: "WCAG 2.2 (2023)",
        url: "https://www.w3.org/TR/WCAG22/",
        application: "Alternative text, colour contrast and the use of colour in figures.",
      },
      {
        name: "Crossref DOI display guidelines",
        issuer: "Crossref",
        edition: "Current",
        url: "https://www.crossref.org/display-guidelines/",
        application: "DOIs displayed as full https://doi.org/ links in references and on the article.",
      },
    ],
    sections: [
      {
        heading: "General principles",
        paragraphs: [
          "Write for an intelligent reader outside your immediate subfield. Eleventh Press is multidisciplinary, and your reviewers and readers may include specialists in adjacent fields. Prefer short sentences, define technical terms and abbreviations at first use, and explain the purpose of a method before its details.",
          "Use British or American English consistently. Number all pages and, if possible, lines, which makes reviewers' comments easier to locate.",
        ],
      },
      {
        heading: "Structure of the manuscript",
        paragraphs: [
          "Most empirical articles follow the introduction–methods–results–discussion structure, but use the conventional structure of your field where it differs, as it often does in mathematics, law, the humanities and theoretical work. Use no more than three levels of headings and number them only if your field expects it.",
          "Methods should be described in enough detail for a qualified reader to reproduce the work, with reference to the reporting guideline you followed. Long protocols, additional analyses and extended data belong in supplementary material or a linked repository.",
        ],
      },
      {
        heading: "References and in-text citations",
        paragraphs: [
          "At submission, any complete and consistent reference style is acceptable. At production, references are normalised to house style, which follows APA 7th edition author–date conventions. In-text citations take the form (Author, Year) or Author (Year); use “et al.” for three or more authors; and list references alphabetically by first author.",
          "Every reference must contain enough information to be resolved unambiguously: the full author list, year, title, journal or publisher, volume, issue and pages or article number, and a DOI wherever one exists. Write DOIs as resolvable links in the form https://doi.org/10.xxxx/xxxxx. During production, DOIs are validated against OpenAlex to catch broken, mistyped or non-existent references before publication. Unresolvable references are queried with the author.",
        ],
        bullets: [
          "Journal article: Author, A. A., & Author, B. B. (Year). Title of article. Journal Name, Volume(Issue), pages. https://doi.org/...",
          "Book: Author, A. A. (Year). Title of book (Edition). Publisher. https://doi.org/...",
          "Dataset: Author, A. A. (Year). Title of dataset (Version) [Data set]. Repository. https://doi.org/...",
          "Software: Author, A. A. (Year). Title of software (Version) [Computer software]. Repository. https://doi.org/...",
          "Preprint: Author, A. A. (Year). Title [Preprint]. Server. https://doi.org/...",
        ],
        after: "Cite the version of record rather than a preprint where both exist, and cite primary sources rather than reviews where you rely on a specific finding.",
      },
      {
        heading: "Figures",
        paragraphs: [
          "Cite figures in the text in numerical order and give each a self-contained caption: a reader should be able to understand a figure without rereading the surrounding paragraph. Captions should state what is shown, define symbols and error bars, and give sample sizes.",
          "Supply figures at a resolution suitable for print (at least 300 dpi for raster images) or, preferably, as vector files. Use colour-blind-safe palettes, do not rely on colour alone to convey meaning, and keep text inside figures legible at the printed size. Provide concise alternative text for each figure, describing its key message for readers who use screen readers. Image manipulation that alters the scientific meaning of an image is not permitted (see EP-G-06).",
        ],
      },
      {
        heading: "Tables",
        paragraphs: [
          "Create tables with your word processor's table tool or in LaTeX, not as images. Give each a title and number, cite it in order, state units in the column headings, and explain abbreviations and statistical notation in a note below the table. Large tables are better placed in supplementary material or a data repository.",
        ],
      },
      {
        heading: "Numbers, units, dates and mathematics",
        paragraphs: [
          "Use SI units and symbols as defined in the SI Brochure, with a space between number and unit (5 mm, 20 kg). Report statistics with the test statistic, degrees of freedom, exact p-values where possible, effect sizes and confidence intervals. Write dates in data and supplementary files in ISO 8601 format (2026-11-06) to avoid day–month ambiguity.",
          "Use your word processor's equation editor or LaTeX for mathematics, number displayed equations that are referred to in the text, and define every symbol at first use.",
        ],
      },
      {
        heading: "From accepted manuscript to published article",
        paragraphs: [
          "After acceptance, the manuscript is typeset into house style and converted into three outputs: a print-quality PDF, responsive HTML and JATS XML, the archival standard used by indexers and repositories. Acknowledgements and funding information removed for anonymisation are restored, CRediT roles and identifiers are added to the metadata, and references are validated.",
          "The editorial office may contact the corresponding author with production queries, for example about an unresolvable reference or a missing figure file; answer them promptly. Production is for correcting errors, not for adding new content, and substantive changes after acceptance require the editor's approval. Once published, the version of record can only be changed through a formal, linked correction notice (see EP-G-07), so make sure the accepted manuscript is final.",
        ],
      },
    ],
    checklist: [
      "Pages (and preferably lines) are numbered.",
      "Abbreviations and technical terms are defined at first use.",
      "Headings use no more than three levels.",
      "Every in-text citation appears in the reference list, and vice versa.",
      "References include full author lists, titles, venues, years and DOIs where they exist.",
      "DOIs are written as https://doi.org/ links.",
      "Datasets and software are cited in the reference list.",
      "Figures are cited in order, have self-contained captions and alternative text, and do not rely on colour alone.",
      "Raster figures are at least 300 dpi, or vector files are supplied.",
      "Tables are editable, titled, numbered and have units in column headings.",
      "SI units and ISO 8601 dates are used.",
      "Displayed equations are numbered where referred to, and all symbols defined.",
    ],
    faqs: [
      { q: "Do I need to format my references in APA style before submitting?", a: "No. Any complete and consistent style is acceptable at submission. References are normalised to APA 7th edition house style during production." },
      { q: "What happens if a DOI in my reference list is wrong?", a: "DOIs are validated against OpenAlex during production. Unresolvable or mismatched references are queried with you before publication." },
      { q: "Can I submit in LaTeX?", a: "Yes. LaTeX (.tex) is an accepted format, along with PDF, DOCX, DOC, Markdown, HTML and plain text." },
      { q: "Why do figures need alternative text?", a: "Alternative text lets readers who use screen readers understand a figure's key message, in line with WCAG 2.2 accessibility guidance." },
    ],
    relatedGuides: ["guide-author-submission", "guide-data-code-availability", "guide-corrections-retractions"],
  },

  "guide-reviewer-handbook": {
    id: "guide-reviewer-handbook",
    audience: "Peer reviewers invited by Eleventh Press, including first-time reviewers and members of the Board of Reviewers.",
    purpose:
      "To set out what Eleventh Press expects of a peer review: how to respond to an invitation, the ethical obligations of a reviewer, how to structure a constructive report, and how to apply the scoring rubric, recommendations and confidence rating.",
    scope: "Applies to all peer review of research articles, reviews and book manuscripts, under every review model offered by the journal.",
    metaDescription:
      "Official Eleventh Press reviewer handbook: accepting invitations, confidentiality and conflicts of interest, structuring a review report, the 1–5 scoring rubric, recommendations, confidence and the 14-day window.",
    keywords: ["peer reviewer guidelines", "how to write a peer review", "review report", "peer review ethics", "reviewer conflict of interest", "COPE peer reviewers", "review scoring", "reviewer confidentiality", "peer review timeline", "Board of Reviewers"],
    keyPoints: [
      "Accept an invitation only if you have the expertise, no conflict of interest and time to finish within 14 days.",
      "Treat the manuscript as confidential; do not share it, use its contents or upload it to generative AI tools.",
      "Do not try to identify the authors; tell the editor if you recognise the work.",
      "Declare any competing interest, and decline if it would compromise your judgement.",
      "Structure the report: summary, overall assessment, major issues, minor issues.",
      "Make comments specific, evidence-based and actionable, and keep the tone professional.",
      "Give an overall score from 1 to 5, a recommendation and a confidence rating.",
      "Keep author-facing comments free of your identity and of the recommendation itself.",
      "Use confidential comments to the editor for concerns such as suspected misconduct.",
      "Request an extension rather than let the deadline lapse silently.",
    ],
    standards: [
      {
        name: "COPE Ethical Guidelines for Peer Reviewers",
        issuer: "Committee on Publication Ethics",
        edition: "Version 2 (2017)",
        url: "https://doi.org/10.24318/cope.2019.1.9",
        application: "The basis for reviewers' obligations on expertise, timeliness, confidentiality, competing interests and conduct.",
      },
      {
        name: "Standard Terminology for Peer Review",
        issuer: "NISO / STM",
        edition: "ANSI/NISO Z39.106-2023",
        url: "https://www.niso.org/",
        application: "Defines the review models (identity transparency, reviewer interaction, review information published) used in this handbook.",
      },
      {
        name: "ICMJE Recommendations: responsibilities of peer reviewers",
        issuer: "International Committee of Medical Journal Editors",
        edition: "Current edition",
        url: "https://www.icmje.org/recommendations/",
        application: "Confidentiality, including the prohibition on uploading manuscripts to AI tools that cannot assure confidentiality.",
      },
      {
        name: "COPE Core Practices: peer review processes",
        issuer: "Committee on Publication Ethics",
        edition: "2017",
        url: "https://publicationethics.org/core-practices",
        application: "Transparent description of the review process and the handling of reviewer conduct.",
      },
      {
        name: "EQUATOR Network reporting guidelines",
        issuer: "EQUATOR Network",
        edition: "Library, current",
        url: "https://www.equator-network.org/",
        application: "Checklists reviewers use to assess the completeness of reporting for each study design.",
      },
    ],
    sections: [
      {
        heading: "The role of the reviewer",
        paragraphs: [
          "Peer reviewers advise the editor; they do not make the decision. Your report helps the editor judge whether a manuscript is sound, original and suitable for the journal, and helps the authors improve the work whatever the outcome. The best reviews are those that a thoughtful author, even one whose paper is rejected, would recognise as fair and useful.",
          "For multidisciplinary manuscripts you may be invited to assess one component in particular, such as the statistical model, the qualitative fieldwork or the engineering design. The invitation will say so. Concentrate on that component, comment on others where you are competent, and say plainly where you are not.",
        ],
      },
      {
        heading: "Responding to an invitation",
        paragraphs: ["Before accepting, ask yourself three questions:"],
        bullets: [
          "Expertise: can I evaluate this manuscript, or the component I am asked about, to a high standard?",
          "Conflicts: do I have any personal, professional, financial or intellectual interest that could affect, or be seen to affect, my judgement — including a close relationship with the authors, a recent collaboration or directly competing work?",
          "Time: can I submit a considered report within 14 days of accepting?",
        ],
        after: "If the answer to any question is no, decline promptly, which lets the editor invite someone else without delay. Suggestions of alternative reviewers are always welcome. If you need more time, request an extension when you accept or as soon as you know.",
      },
      {
        heading: "Confidentiality, anonymity and the use of AI tools",
        paragraphs: [
          "A manuscript under review is confidential, unpublished work. Do not share it or discuss it with anyone, including colleagues, without the editor's permission, and do not use any information from it for your own research or advantage. Delete or destroy your copy after the review is complete.",
          "Do not upload the manuscript, or any part of it, to a generative AI tool or other external service that cannot guarantee confidentiality; doing so may disclose the authors' unpublished work. Your report must be your own assessment. Under double-anonymised review, do not try to identify the authors. If you recognise the work, tell the editor in your confidential comments.",
        ],
      },
      {
        heading: "Structuring the report",
        paragraphs: ["A complete Eleventh Press review contains the following parts:"],
        bullets: [
          "Summary: two or three sentences in your own words on what the manuscript claims and how. This shows the authors and the editor that you have understood the work.",
          "Overall assessment: the main strengths, and whether the conclusions follow from the evidence.",
          "Major issues: problems that affect the validity of the conclusions, such as design flaws, inappropriate analyses, missing controls or unsupported claims, each with a suggested remedy where you can give one.",
          "Minor issues: clarity, presentation, missing references and small errors, ideally referenced by page and line.",
          "Reporting: whether the relevant reporting guideline has been followed and whether data and code are available as described.",
        ],
        after: "Be specific and actionable. “Needs more rigour” is not useful; “the sample size in Section 3.2 appears underpowered for the effect size claimed — please report a power analysis or temper the conclusion” is. Comment on the work, never on the authors, and avoid sarcasm and personal remarks.",
      },
      {
        heading: "Scores, recommendations and confidence",
        paragraphs: ["Alongside your comments, the review form asks for three ratings:"],
        bullets: [
          "Overall score (1 to 5): 5, an excellent and important contribution with no significant weaknesses; 4, a strong contribution with minor weaknesses; 3, a sound contribution with weaknesses that need attention; 2, a contribution with major weaknesses that limit its validity or value; 1, fundamentally flawed or unsuitable.",
          "Recommendation: Accept; Minor revisions (limited changes, no further review needed in most cases); Major revisions (substantial changes, likely to be re-reviewed); or Reject.",
          "Confidence: how sure you are of your assessment, given your expertise in the manuscript's subject and methods.",
        ],
        after: "Keep the recommendation out of your comments to the authors; the editor communicates the decision, which may differ from any single recommendation.",
      },
      {
        heading: "Comments to the editor",
        paragraphs: [
          "Confidential comments to the editor are the place for anything that should not go to the authors: your view on the suitability of the work for the journal, a note that you recognised the authors, or concerns about possible misconduct, such as plagiarism, duplicate publication, image manipulation or data fabrication. Report such concerns to the editor; do not investigate them yourself or contact the authors.",
        ],
      },
      {
        heading: "Deadlines, revisions and recognition",
        paragraphs: [
          "You have 14 days from accepting an invitation to submit your review. If you need more time, request an extension rather than letting the deadline lapse silently: editors would rather adjust the timeline than lose a well-matched reviewer.",
          "If the manuscript is revised, you may be asked to review the revision. Focus on whether your points and those of other reviewers have been addressed, and avoid raising new issues unless they arise from the changes or are serious.",
          "Reviewers who connect their ORCID iD to their account with update permission can have submitted reviews credited on their ORCID record. Members of the Board of Reviewers can be issued a formal service certificate.",
        ],
      },
    ],
    checklist: [
      "I have the expertise to review this manuscript, or the component assigned to me.",
      "I have no conflict of interest, or I have declared it to the editor.",
      "I can submit within 14 days, or I have requested an extension.",
      "I have kept the manuscript confidential and have not uploaded it to any AI tool.",
      "I have not tried to identify the authors.",
      "My report includes a summary, an overall assessment, major issues and minor issues.",
      "My comments are specific, evidence-based and actionable.",
      "I have checked reporting against the relevant guideline and data availability.",
      "I have given an overall score, a recommendation and a confidence rating.",
      "My comments to the authors do not reveal my identity or my recommendation.",
      "Any concerns about misconduct are in my confidential comments to the editor.",
    ],
    faqs: [
      { q: "How long do I have to complete a review?", a: "Fourteen days from accepting the invitation. Request an extension if you need more time." },
      { q: "Can I ask a student or colleague to help with a review?", a: "Only with the editor's prior permission, and their name should be given to the editor so they are bound by the same confidentiality." },
      { q: "Can I use an AI tool to help write my review?", a: "Do not upload the manuscript or any part of it to an AI tool that cannot guarantee confidentiality. The assessment must be your own." },
      { q: "What should I do if I suspect plagiarism or data manipulation?", a: "Explain your concern in the confidential comments to the editor. Do not investigate it yourself or contact the authors." },
      { q: "Will my name be shown to the authors?", a: "Not under single- or double-anonymised review. Under open review, identities are known, and if the authors opt in to open peer review your report may be published." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-formatting-citation"],
  },

  "guide-apc-waiver": {
    id: "guide-apc-waiver",
    audience: "Authors for whom the article processing charge would be a barrier to publication.",
    purpose: `To explain who can request a full or partial waiver of the ${J.apc} article processing charge, how to apply, how requests are assessed, and the safeguards that keep waiver requests entirely separate from editorial decisions.`,
    scope: "Applies to all accepted and under-review research articles. It does not cover book production or distribution costs, which are agreed separately with the book division.",
    metaDescription: `Official Eleventh Press APC waiver guide: eligibility for full and partial waivers of the ${J.apc} article processing charge, how to apply, how requests are assessed and how they are kept separate from peer review.`,
    keywords: ["APC waiver", "article processing charge waiver", "open access fee waiver", "publication fee discount", "low-income countries", "Research4Life", "Plan S waiver", "open access funding", "fee transparency", "equitable open access"],
    keyPoints: [
      `The APC is ${J.apc}, charged once, only after acceptance; there is no submission fee.`,
      "Any author for whom the APC is a genuine barrier may request a waiver.",
      "Both full and partial waivers are available.",
      "Request a waiver at submission in the form; if your circumstances change later, email the editorial office.",
      "A short explanation of your funding situation is enough; elaborate documentation is not normally required.",
      "Requests are assessed by the editorial office, never by reviewers or the handling editor.",
      "A waiver request never influences the peer-review outcome.",
      "An approved waiver does not delay production.",
      "Check grants, institutional open-access funds and library agreements before applying.",
      "Information you share in a waiver request is kept confidential.",
    ],
    standards: [
      {
        name: "Principles of Transparency and Best Practice in Scholarly Publishing",
        issuer: "COPE, DOAJ, OASPA and WAME",
        edition: "Version 4 (2022)",
        url: "https://doaj.org/apply/transparency/",
        application: "Fees and waiver policies are published in advance, and editorial decisions are not influenced by an author's ability to pay.",
      },
      {
        name: "Plan S Principles",
        issuer: "cOAlition S",
        edition: "2018, with implementation guidance",
        url: "https://www.coalition-s.org/plan_s_principles/",
        application: "Expectation of waivers or discounts for authors from lower-income economies, and of transparent, reasonable fees.",
      },
      {
        name: "World Bank country income classifications",
        issuer: "World Bank",
        edition: "Current fiscal year",
        url: "https://datahelpdesk.worldbank.org/knowledgebase/articles/906519",
        application: "Reference point for assessing requests from authors based in low- and lower-middle-income economies.",
      },
      {
        name: "Research4Life eligibility",
        issuer: "Research4Life partnership",
        edition: "Current country lists",
        url: "https://www.research4life.org/access/eligibility/",
        application: "Reference point: authors in Research4Life Group A and B countries are strongly encouraged to apply.",
      },
      {
        name: "COPE Core Practices: journal management",
        issuer: "Committee on Publication Ethics",
        edition: "2017",
        url: "https://publicationethics.org/core-practices",
        application: "Separation of business and editorial decisions.",
      },
    ],
    sections: [
      {
        heading: "What the APC covers",
        paragraphs: [
          `The ${J.apc} APC funds editorial and peer-review coordination, DOI registration with ${DOI_REGISTRAR}, production into PDF, HTML and JATS XML, permanent open-access hosting and indexing, and eligibility for the syndication network and book division. It is invoiced once, after acceptance. There is no submission fee and no charge for pages, colour or revisions.`,
        ],
      },
      {
        heading: "Who may request a waiver",
        paragraphs: [
          "Any author for whom the APC is a genuine barrier may request a waiver. We particularly encourage requests from authors based in low- and lower-middle-income economies, as classified by the World Bank, and in countries eligible for Research4Life; from early-career and independent researchers without institutional funding; from students; and from authors working in fields or regions where open-access funding is scarce.",
          "These are reference points, not exclusive categories. A researcher in a high-income country without access to funding is equally entitled to ask.",
        ],
      },
      {
        heading: "Full and partial waivers",
        paragraphs: [
          "A full waiver removes the APC entirely. A partial waiver reduces it to an amount you can manage, and is appropriate where a full waiver isn't warranted but the full fee is still a genuine burden. Ask for what you need rather than assuming it is all or nothing; the editorial office can suggest a partial waiver where it fits.",
        ],
      },
      {
        heading: "Before you apply: other funding sources",
        paragraphs: ["Many authors can have the APC paid without a waiver. Before applying, check:"],
        bullets: [
          "Your research grant, which may list publication costs as an eligible expense, particularly if your funder mandates open access.",
          "Your institution's open-access fund or library publication budget.",
          "Any transformative, read-and-publish or membership agreement your institution holds.",
          "Your department, research centre or professional society, some of which fund publication costs.",
        ],
      },
      {
        heading: "How to apply",
        paragraphs: [
          `The simplest route is at submission: switch on “Request an APC waiver” in the submission form and briefly explain your funding situation. If you did not request a waiver at submission, or your circumstances change while the manuscript is under review or after acceptance, email the editorial office at ${J.editorialEmail} with your submission ID and the same information, before the APC invoice is paid.`,
          "A few sentences are enough: your position, whether you have access to grant or institutional funding, and whether you are requesting a full or partial waiver. Elaborate documentation is not required for standard requests, although the editorial office may occasionally ask a follow-up question.",
        ],
      },
      {
        heading: "How requests are assessed and kept separate",
        paragraphs: [
          "Waiver requests are reviewed by the editorial office, not by your reviewers or your handling editor. Reviewers never see whether a waiver has been requested, and the handling editor's decision is made on the merits of the manuscript alone. A pending or approved request never affects the peer-review outcome, and an approved waiver does not delay production.",
          "Decisions are communicated to the corresponding author. If a request is declined or only partially granted and your circumstances have been misunderstood, you may write to the editorial office with additional information.",
        ],
      },
      {
        heading: "Confidentiality",
        paragraphs: [
          "Information you provide in a waiver request is used only to assess that request, is visible only to the editorial office staff who handle it, and is not shared with reviewers, editors or third parties.",
        ],
      },
    ],
    checklist: [
      "I have checked my grant, institution and library for APC funding.",
      "I know whether I need a full or a partial waiver.",
      "I have written a short explanation of my funding situation.",
      "I have submitted the request through the submission form, or by email with my submission ID.",
      "I understand that the request will not affect the review of my manuscript.",
    ],
    faqs: [
      { q: "Will requesting a waiver affect whether my paper is accepted?", a: "No. Requests are handled by the editorial office, separately from reviewers and the handling editor, and play no part in the editorial decision." },
      { q: "When should I request a waiver?", a: `Ideally at submission, using the waiver option in the form. If your circumstances change later, email ${J.editorialEmail} with your submission ID before the APC invoice is paid.` },
      { q: "What documents do I need?", a: "Usually none. A brief explanation of your funding situation is enough for a standard request." },
      { q: "Is a partial waiver possible?", a: "Yes. Partial waivers are available where the full fee is a genuine burden but a reduced amount is manageable." },
      { q: "I am in a high-income country but have no funding. Can I apply?", a: "Yes. Country income classifications are a reference point, not an exclusive list. Any author for whom the APC is a genuine barrier may apply." },
    ],
    relatedGuides: ["guide-author-submission", "guide-publication-ethics"],
  },

  "guide-data-code-availability": {
    id: "guide-data-code-availability",
    audience: "Authors of research that produces or uses data, code, models or other research materials.",
    purpose:
      "To explain how to make the data and code underlying a published article findable, accessible, interoperable and reusable: writing the data availability statement, choosing a repository, licensing, citation and the handling of sensitive data.",
    scope: "Applies to all research articles. Every submission requires a data availability statement; open sharing is required where a funder mandates it and strongly encouraged everywhere else.",
    metaDescription:
      "Official Eleventh Press data and code availability guide: data availability statements with templates, FAIR repositories, Zenodo linking, licences, data and software citation, and sensitive data.",
    keywords: ["data availability statement", "FAIR data", "research data sharing", "code availability", "Zenodo", "data citation", "software citation", "CC0", "sensitive data", "reproducibility"],
    keyPoints: [
      "Every submission needs a data availability statement; “not applicable” is valid only where no data were generated or analysed.",
      "Share data in a trusted repository that issues persistent identifiers, ideally a discipline-specific one.",
      "Zenodo records can be linked directly to your article and give the dataset its own citable DOI.",
      "Follow the FAIR principles: rich metadata, persistent identifiers, open formats and a clear licence.",
      "Cite datasets and software in the reference list, with version and DOI.",
      "Release data under CC0 or CC BY, and code under an OSI-approved licence.",
      "Archive the exact version of the code used, with its dependencies, and give it a DOI.",
      "Sensitive data may be shared under controlled access; explain the conditions in the statement.",
      "Respect Indigenous data sovereignty following the CARE principles.",
      "Keep links current: broken data links are among the most common post-publication correction requests.",
    ],
    standards: [
      {
        name: "FAIR Guiding Principles",
        issuer: "Wilkinson et al., Scientific Data",
        edition: "2016",
        url: "https://doi.org/10.1038/sdata.2016.18",
        application: "Findable, Accessible, Interoperable and Reusable: the overall standard for shared data and code.",
      },
      {
        name: "Joint Declaration of Data Citation Principles",
        issuer: "FORCE11",
        edition: "2014",
        url: "https://force11.org/info/joint-declaration-of-data-citation-principles-final/",
        application: "Data are cited in the reference list with persistent identifiers, like any other scholarly output.",
      },
      {
        name: "Software Citation Principles",
        issuer: "FORCE11 (Smith, Katz & Niemeyer)",
        edition: "2016",
        url: "https://doi.org/10.7717/peerj-cs.86",
        application: "Research software is cited by version and identifier, and its authors credited.",
      },
      {
        name: "Transparency and Openness Promotion (TOP) Guidelines",
        issuer: "Center for Open Science",
        edition: "Current",
        url: "https://www.cos.io/initiatives/top-guidelines",
        application: "Data, code and materials transparency, and citation standards for journals.",
      },
      {
        name: "CARE Principles for Indigenous Data Governance",
        issuer: "Global Indigenous Data Alliance",
        edition: "2019",
        url: "https://www.gida-global.org/care",
        application: "Collective benefit, authority to control, responsibility and ethics for data about Indigenous peoples.",
      },
      {
        name: "UK GDPR and Data Protection Act 2018",
        issuer: "United Kingdom",
        edition: "Current",
        url: "https://ico.org.uk/",
        application: "Lawful processing, anonymisation and controlled sharing of personal data.",
      },
    ],
    sections: [
      {
        heading: "Why data and code availability matters",
        paragraphs: [
          "Readers can only evaluate, reproduce and build on research if they can access what it rests on. Shared data and code make errors easier to find and correct, allow results to be combined in syntheses, and give credit to the people who created them. Funders increasingly require sharing, and articles with available data are easier to trust.",
          "For these reasons every submission to Eleventh Press includes a data availability statement. Linking open data is required where a funder mandate specifies it and strongly encouraged everywhere else.",
        ],
      },
      {
        heading: "What to share",
        paragraphs: ["Share the minimum material a qualified reader needs to verify and reproduce the reported results:"],
        bullets: [
          "The data underlying every figure, table and statistical result, in raw or processed form as appropriate.",
          "The code used for data collection, cleaning, analysis and figure generation.",
          "Codebooks, data dictionaries and README files describing variables, units and structure.",
          "Protocols, instruments, questionnaires, models and other research materials.",
        ],
      },
      {
        heading: "Writing the data availability statement",
        paragraphs: ["The statement tells readers where the data and code are and how to access them. Adapt one of these templates:"],
        bullets: [
          "Publicly available: “The data and code supporting this study are openly available in [repository] at https://doi.org/[DOI], under a [licence] licence.”",
          "Controlled access: “The data are available from [repository or body] under controlled access, subject to [conditions], because they contain [reason]. Code is openly available at https://doi.org/[DOI].”",
          "Third-party data: “The data were obtained from [provider] under licence and are available from them at [URL] subject to their terms.”",
          "On request (only where justified): “The data are available from the corresponding author on reasonable request, because [specific reason].”",
          "Not applicable: “No data were generated or analysed in this study.”",
        ],
        after: "“Available on request” is a last resort, because such requests often go unanswered. Where it is used, the reason must be stated.",
      },
      {
        heading: "Choosing a repository",
        paragraphs: [
          "Use a trusted repository that issues persistent identifiers such as DOIs, commits to long-term preservation and supports rich metadata. Discipline-specific repositories are preferred where they exist, because their communities know how to find and reuse the data. Generalist repositories are a good alternative.",
          "Eleventh Press supports linking Zenodo records directly to your submission as a dataset link. Zenodo, operated by CERN, gives the dataset its own citable DOI alongside the article's, supports versioning, and can archive GitHub releases automatically. Whatever repository you choose, enter the identifier in the submission form and in the statement.",
        ],
      },
      {
        heading: "Licensing data and code",
        paragraphs: [
          "Release data under CC0 (a public-domain dedication that removes legal barriers to reuse) or CC BY 4.0. Release code under a licence approved by the Open Source Initiative, such as MIT, BSD-3-Clause or Apache 2.0, or a copyleft licence such as GPL-3.0 if you want derivatives to stay open. Creative Commons licences are not designed for software.",
          "Make sure you have the right to share: data obtained from third parties, or collected under consent forms that limit reuse, may need different arrangements.",
        ],
      },
      {
        heading: "Citing data and software",
        paragraphs: [
          "Cite datasets and software in the reference list, as you would articles, following the Joint Declaration of Data Citation Principles and the Software Citation Principles. A citation should include the creators, year, title, version, repository or publisher, and persistent identifier, for example: Author, A. A. (2026). Title of dataset (Version 1.2) [Data set]. Zenodo. https://doi.org/10.5281/zenodo.xxxxxxx.",
          "Cite the specific version you used. For code, archive the exact release that produced your results, record its dependencies (for example with a requirements, environment or lock file) and give it a DOI.",
        ],
      },
      {
        heading: "Sensitive, personal and Indigenous data",
        paragraphs: [
          "Not all data can be fully open. Personal data must be processed lawfully, which for a journal based in London means in line with UK GDPR and the Data Protection Act 2018 as well as the law that applies where the data were collected. Anonymise data where possible, remembering that combinations of variables can re-identify people. Where anonymisation would destroy the data's value, share through a controlled-access repository or data enclave and describe the access conditions.",
          "Data about Indigenous peoples should follow the CARE Principles for Indigenous Data Governance — collective benefit, authority to control, responsibility and ethics — alongside FAIR. Data that could cause harm if released, such as the locations of endangered species or security-sensitive information, may also justify restrictions. Explain any restriction in the statement.",
        ],
      },
      {
        heading: "Keeping links current",
        paragraphs: [
          "Update the dataset link if your repository record moves or a new version is released. Broken data links are among the most common post-publication correction requests we receive. Persistent identifiers such as DOIs resolve even when the underlying URL changes, which is one more reason to prefer them over plain web addresses.",
        ],
      },
    ],
    checklist: [
      "A data availability statement is included and specific.",
      "Data underlying all reported results are deposited in a trusted repository.",
      "Analysis code is archived at the exact version used, with dependencies recorded.",
      "Each dataset and code release has a persistent identifier, such as a DOI.",
      "Data are licensed under CC0 or CC BY, and code under an OSI-approved licence.",
      "README files, codebooks or data dictionaries are included.",
      "Datasets and software are cited in the reference list with versions and DOIs.",
      "Any restriction on access is justified, with access conditions described.",
      "Personal data are anonymised or shared under controlled access.",
      "The dataset link is entered in the submission form.",
    ],
    faqs: [
      { q: "Is sharing data mandatory?", a: "A data availability statement is mandatory for every submission. Open sharing is required where your funder mandates it and strongly encouraged in all other cases." },
      { q: "Can I link a Zenodo dataset to my article?", a: "Yes. Zenodo records can be linked directly at submission and give the dataset its own citable DOI alongside the article's." },
      { q: "Which licence should I use for my data?", a: "CC0 or CC BY 4.0 for data, and an OSI-approved licence such as MIT or Apache 2.0 for code." },
      { q: "My data contain personal information. What should I do?", a: "Anonymise the data if possible; otherwise share them through a controlled-access repository and explain the access conditions in the statement." },
    ],
    relatedGuides: ["guide-author-submission", "guide-formatting-citation", "guide-publication-ethics"],
  },

  "guide-publication-ethics": {
    id: "guide-publication-ethics",
    audience: "Authors, reviewers, editors and readers of Eleventh Press.",
    purpose:
      "To state the journal's policy on publication ethics and research integrity, aligned with COPE and ICMJE, covering authorship, AI tools, plagiarism, data and image integrity, conflicts of interest, ethical oversight, peer-review conduct, complaints and the reporting and investigation of concerns.",
    scope: "Applies to all content submitted to or published by Eleventh Press, and to everyone involved in its editorial process.",
    metaDescription:
      "Official Eleventh Press publication ethics and research integrity statement: authorship, AI tools, plagiarism, image and data integrity, conflicts of interest, ethics approval, paper mills, complaints and how to report a concern.",
    keywords: ["publication ethics", "research integrity", "COPE", "ICMJE authorship", "plagiarism policy", "conflict of interest", "image manipulation", "paper mills", "AI authorship policy", "research misconduct"],
    keyPoints: [
      "Eleventh Press aligns its policies with COPE Core Practices and the ICMJE Recommendations.",
      "Everyone listed as an author must meet all four ICMJE criteria; gift, guest and ghost authorship are not permitted.",
      "AI tools cannot be authors; their use must be disclosed and authors remain accountable.",
      "Every submission is checked for textual similarity before it reaches a reviewer.",
      "Fabrication, falsification and inappropriate image manipulation are serious misconduct.",
      "Authors, reviewers and editors must declare competing interests; editors and reviewers recuse themselves where one exists.",
      "Research with human participants or animals needs ethics approval and, where applicable, informed consent.",
      "Coercive citation and citation manipulation are prohibited.",
      `Report a concern to ${J.editorialEmail} with the article's DOI or submission ID.`,
      "Substantiated concerns lead to a public, linked notice; the original record is never silently altered.",
    ],
    standards: [
      {
        name: "COPE Core Practices",
        issuer: "Committee on Publication Ethics",
        edition: "2017, with COPE flowcharts",
        url: "https://publicationethics.org/core-practices",
        application: "The ten core practices structure this statement, and COPE flowcharts guide the handling of specific cases.",
      },
      {
        name: "ICMJE Recommendations",
        issuer: "International Committee of Medical Journal Editors",
        edition: "Current edition",
        url: "https://www.icmje.org/recommendations/",
        application: "Authorship criteria, disclosure of competing interests and the use of AI-assisted technologies.",
      },
      {
        name: "Declaration of Helsinki",
        issuer: "World Medical Association",
        edition: "2024 revision",
        url: "https://www.wma.net/policies-post/wma-declaration-of-helsinki/",
        application: "Ethical principles for research involving human participants.",
      },
      {
        name: "The European Code of Conduct for Research Integrity",
        issuer: "ALLEA",
        edition: "Revised edition 2023",
        url: "https://allea.org/code-of-conduct/",
        application: "Definitions of research misconduct (fabrication, falsification, plagiarism) and other unacceptable practices.",
      },
      {
        name: "Singapore Statement on Research Integrity",
        issuer: "2nd World Conference on Research Integrity",
        edition: "2010",
        url: "https://www.wcrif.org/guidance/singapore-statement",
        application: "The international principles of honesty, accountability, professional courtesy and good stewardship.",
      },
      {
        name: "ARRIVE guidelines",
        issuer: "NC3Rs",
        edition: "ARRIVE 2.0 (2020)",
        url: "https://arriveguidelines.org/",
        application: "Reporting and ethical standards for research involving animals.",
      },
      {
        name: "Paper Mills: Research report from COPE & STM",
        issuer: "COPE and STM",
        edition: "2022",
        url: "https://publicationethics.org/",
        application: "Indicators and handling of manuscripts produced by paper mills.",
      },
    ],
    sections: [
      {
        heading: "Our commitment",
        paragraphs: [
          `${J.name} is committed to the integrity of the scholarly record. Our policies are aligned with the Core Practices of the Committee on Publication Ethics (COPE) and the Recommendations of the International Committee of Medical Journal Editors (ICMJE), which we apply across all twelve of our disciplines. Alignment describes the standards we follow; it is not a claim of membership or certification by those bodies.`,
        ],
      },
      {
        heading: "Authorship and contributorship",
        paragraphs: [
          "Everyone listed as an author must meet all four ICMJE criteria: substantial contribution to the conception, design, data or analysis; drafting or critical revision; approval of the final version; and accountability for the work. Gift or guest authorship (listing people who did not contribute) and ghost authorship (omitting people who did) are not permitted. Contributors who do not meet the criteria are acknowledged, with their permission.",
          "CRediT roles make individual contributions transparent. Authorship disputes are resolved by the handling editor before publication, following COPE guidance; we do not adjudicate them after the fact, which is much harder to do fairly. Where disputes cannot be resolved, we may refer them to the authors' institutions.",
        ],
      },
      {
        heading: "Generative AI and automated tools",
        paragraphs: [
          "Generative AI tools cannot be listed as authors, because they cannot take responsibility for the work, approve it or be held accountable. Authors who use such tools in writing, data analysis, coding or image generation must disclose the tool and its purpose. Authors remain fully responsible for the accuracy, originality and integrity of all content, including citations, which must be checked against the sources. AI-generated images and data presented as research findings are not acceptable unless the generation is itself the subject of the research and is fully described.",
          "Reviewers and editors must not upload manuscripts to AI tools that cannot guarantee confidentiality.",
        ],
      },
      {
        heading: "Plagiarism, duplicate publication and citation manipulation",
        paragraphs: [
          "Plagiarism — presenting others' words, ideas, data or images as one's own without attribution — is research misconduct. Every submission runs through an automated in-corpus similarity check before it reaches a reviewer, and similarity reports are interpreted by an editor, since overlap in methods text or properly quoted material can be legitimate.",
          "Redundant or duplicate publication, meaning the publication of substantially the same work in more than one venue without disclosure, and simultaneous submission to more than one journal are not permitted. Preprints are not prior publication but must be declared. Coercive citation (pressing authors to cite a journal or individual) and citation stacking or cartels are prohibited. References are validated against OpenAlex during production, so that unresolvable or fabricated references are caught before publication.",
        ],
      },
      {
        heading: "Data integrity and image manipulation",
        paragraphs: [
          "Fabrication (inventing data or results) and falsification (manipulating materials, equipment, processes or data so that the research is not accurately represented) are serious misconduct. Authors should keep their raw data and be prepared to provide them to the editor on request.",
          "Images may be adjusted for brightness, contrast or colour balance only if the adjustment is applied to the whole image and does not obscure, eliminate or misrepresent information. Splicing, duplicating, moving or removing features is not permitted unless clearly indicated and explained in the caption. Manuscripts showing signs of systematic manipulation or of production by paper mills, such as tortured phrases, irrelevant references or duplicated images across unrelated papers, are investigated following COPE and STM guidance.",
        ],
      },
      {
        heading: "Conflicts of interest",
        paragraphs: [
          "Authors must disclose all financial and non-financial interests that could be perceived as influencing their work, such as funding, employment, consultancies, shareholdings, patents, personal relationships and strongly held beliefs relevant to the topic. A declaration is required at submission, even if it is “none”.",
          "Reviewers and editors must disclose any competing interest with a submission's authors or subject matter, such as a shared institution, a recent collaboration, a personal relationship or directly competing work, and recuse themselves from handling that submission where one exists. Submissions by editors or members of the editorial board are handled by an independent editor, and the author has no access to the review process.",
        ],
      },
      {
        heading: "Ethical oversight",
        paragraphs: [
          "Research involving human participants, identifiable personal data or human material must have been approved by an appropriate ethics committee or institutional review board, in line with the Declaration of Helsinki, and the manuscript must report the committee and approval reference. Informed consent must be obtained and reported; identifiable images or details require specific consent to publication.",
          "Research involving animals must comply with applicable law and institutional approval and should be reported following the ARRIVE guidelines. Where approval was not required, the manuscript must explain why. Editors may request documentation, and manuscripts without adequate oversight may be rejected at any stage.",
        ],
      },
      {
        heading: "Reporting a concern and how it is investigated",
        paragraphs: [
          `Anyone may raise a concern about a submission or a published article. Email ${J.editorialEmail} with the article's DOI (if published) or submission ID and a description of the issue, with any supporting evidence. Concerns can be raised anonymously, though contact details help us ask follow-up questions; we treat the identity of those raising concerns as confidential.`,
          "The editorial office investigates following COPE flowcharts, independently of the original handling editor wherever a conflict of interest is possible. Authors are informed of the concern and given an opportunity to respond. Where appropriate we contact the authors' institutions, which may carry out their own investigation. Outcomes range from no action, through a correction, an expression of concern or a retraction, to notifying institutions or funders. Every substantiated concern about a published article leads to a public, linked notice (see EP-G-07).",
        ],
      },
      {
        heading: "Complaints and appeals",
        paragraphs: [
          "Complaints about the editorial process, and requests for reconsideration of a decision on the grounds of a factual error in the review, are made to the handling editor or, where the complaint concerns the editor, to the editorial office. There is no formal appeal for scope decisions. Complaints are acknowledged, investigated by someone not involved in the original decision, and answered in writing.",
        ],
      },
    ],
    checklist: [
      "All listed authors meet the four ICMJE criteria; other contributors are acknowledged.",
      "Use of AI tools is disclosed and all content and citations have been verified.",
      "The work is original, not under consideration elsewhere, and any preprint is declared.",
      "Quoted and reused material is attributed; reused figures have permission.",
      "Images are unmanipulated beyond whole-image adjustments, with any exceptions explained.",
      "Raw data are retained and can be provided to the editor on request.",
      "All competing interests are declared.",
      "Ethics approval and consent, or the reasons they were not needed, are reported.",
      "Animal research follows ARRIVE and applicable law.",
    ],
    faqs: [
      { q: "How do I report a concern about a published article?", a: `Email ${J.editorialEmail} with the article's DOI and a description of the issue, with any evidence. The identity of those raising concerns is kept confidential.` },
      { q: "Is Eleventh Press a member of COPE?", a: "Our policies are aligned with COPE Core Practices and the ICMJE Recommendations. Alignment describes the standards we follow; it is not a claim of membership or certification." },
      { q: "Can I use ChatGPT or other AI tools to write my paper?", a: "AI tools may assist, but their use must be disclosed, they cannot be authors, and you remain responsible for the accuracy and integrity of all content, including citations." },
      { q: "What happens if plagiarism is found after publication?", a: "The concern is investigated following COPE guidance and, if substantiated, leads to a public, linked notice such as a correction or retraction." },
      { q: "Who handles a submission from an editor?", a: "An independent editor. The submitting editor has no access to the review process." },
    ],
    relatedGuides: ["guide-corrections-retractions", "guide-author-submission", "guide-reviewer-handbook"],
  },

  "guide-corrections-retractions": {
    id: "guide-corrections-retractions",
    audience: "Authors, readers, editors, indexers and anyone who cites Eleventh Press articles.",
    purpose:
      "To define the post-publication notices Eleventh Press issues, the circumstances in which each is used, how they are issued and linked to the original article, and how to request a correction or report a concern.",
    scope: "Applies to all articles after publication of the version of record. Changes before publication are made through the normal editorial and proof process.",
    metaDescription:
      "Official Eleventh Press guide to corrections, errata, expressions of concern and retractions: definitions, when each is used, how notices are issued and linked, and how to request a correction.",
    keywords: ["corrigendum", "erratum", "retraction", "expression of concern", "correction notice", "COPE retraction guidelines", "version of record", "post-publication", "scholarly record", "NISO CREC"],
    keyPoints: [
      "The published version of record is permanent and is never silently altered or deleted.",
      "A Corrigendum corrects a significant error made by the authors.",
      "An Erratum corrects a significant error introduced by the publisher during production.",
      "An Expression of Concern alerts readers to a serious, unresolved doubt while an investigation proceeds.",
      "A Retraction withdraws an article whose findings are unreliable or whose publication breached ethics.",
      "Every notice is published as a permanent, linked addendum, cross-linked with the original article.",
      "Retracted articles remain available, clearly marked as retracted, with the reason stated.",
      "Every notice also appears in the article's post-publication status and provenance timeline.",
      `Authors request corrections, and anyone reports concerns, by email to ${J.editorialEmail}.`,
      "Investigations follow COPE guidance and are handled independently of the original editor where needed.",
    ],
    standards: [
      {
        name: "COPE Retraction Guidelines",
        issuer: "Committee on Publication Ethics",
        edition: "2019 (updating Wager et al., 2009)",
        url: "https://doi.org/10.24318/cope.2019.1.4",
        application: "When to retract, issue an expression of concern or correct, and the content of each notice.",
      },
      {
        name: "Communication of Retractions, Removals, and Expressions of Concern (CREC)",
        issuer: "NISO",
        edition: "NISO RP-45-2024",
        url: "https://www.niso.org/",
        application: "How notices are displayed, linked and communicated in metadata so that downstream systems and readers see them.",
      },
      {
        name: "ICMJE Recommendations: corrections, retractions and expressions of concern",
        issuer: "International Committee of Medical Journal Editors",
        edition: "Current edition",
        url: "https://www.icmje.org/recommendations/",
        application: "Notices are published as citable items, linked bidirectionally with the original article.",
      },
      {
        name: "Journal Article Versions (JAV)",
        issuer: "NISO/ALPSP",
        edition: "NISO RP-8-2008",
        url: "https://www.niso.org/",
        application: "Defines the version of record and the corrected version of record.",
      },
      {
        name: "COPE Core Practices: post-publication discussions and corrections",
        issuer: "Committee on Publication Ethics",
        edition: "2017",
        url: "https://publicationethics.org/core-practices",
        application: "Mechanisms for correcting, revising or retracting articles after publication.",
      },
    ],
    sections: [
      {
        heading: "Principles",
        paragraphs: [
          "The published article, the version of record, is a permanent part of the scholarly record. When something in it needs to change, we do not edit it silently; we publish a notice that explains what changed and why, linked to the original article, so that anyone who has read or cited the work can see the history. This follows the COPE Retraction Guidelines, the ICMJE Recommendations and NISO's recommended practice on communicating retractions and expressions of concern.",
          "Notices are proportionate. Most post-publication issues are honest errors that warrant a correction; retraction is reserved for cases where the findings cannot be relied on or where publication was itself a breach of ethics.",
        ],
      },
      {
        heading: "The four notice types",
        paragraphs: ["Eleventh Press issues four kinds of post-publication notice:"],
        bullets: [
          "Corrigendum: corrects a significant error made by the authors, such as a mistaken value in a table, a mislabelled figure or an omitted author or funder, where the error does not invalidate the conclusions.",
          "Erratum: corrects a significant error introduced by the publisher during typesetting or production, for example a dropped line, a misplaced figure or incorrect metadata.",
          "Expression of Concern: alerts readers to serious doubts about an article, for example inconclusive evidence of misconduct, unreliable findings or an institutional investigation that has not yet concluded. It may later be withdrawn, or followed by a correction or retraction.",
          "Retraction: withdraws an article because its findings are unreliable through major error or misconduct, because it is plagiarised or redundant, because it reports unethical research, or because of a compromised peer-review process.",
        ],
        after: "Minor errors that do not affect the meaning or the reader's ability to use the work, such as a spelling mistake, do not normally warrant a notice.",
      },
      {
        heading: "Who can initiate a notice",
        paragraphs: [
          "Authors who discover an error in their published article should contact us as soon as possible; prompt self-correction is a mark of good practice, not of failure. Readers, reviewers, institutions and editors can raise concerns about any published article. The editor decides which notice, if any, is appropriate, after consulting the authors and, where relevant, reviewers, institutions or independent experts.",
          "Authors may request a retraction of their own work when they discover an error that invalidates it. Retraction for honest error is distinguished in the notice from retraction for misconduct.",
        ],
      },
      {
        heading: "How a notice is issued",
        paragraphs: ["Each notice goes through the following steps:"],
        bullets: [
          "The concern or correction request is assessed by the editor; where a conflict of interest is possible, the editorial office handles it independently of the original handling editor.",
          "The authors are informed and invited to respond, and for corrections they approve the wording.",
          "For suspected misconduct, the investigation follows COPE flowcharts and may involve the authors' institutions.",
          "The editor decides on the notice and its wording, which states clearly what is being corrected, retracted or questioned, and why.",
          "The notice is published as a citable item, linked to and from the original article.",
        ],
      },
      {
        heading: "How notices are displayed and propagated",
        paragraphs: [
          "Every notice is published as a permanent, linked addendum to the original article, and the article page displays the article's post-publication status in a prominent banner that links to each notice. The notice records exactly what changed and why, so that anyone who read or cited the earlier text can see the difference. A retracted article remains available, clearly marked as retracted, with the retraction notice and its reason; it is not removed.",
          "Notices are also recorded in the article's provenance record. Its post-publication status is updated and the notice appears in the verification timeline, so the live verification page and any certificate downloaded from it show the article's current status. When you cite a corrected article, cite the notice as well, so readers of your work can find it.",
        ],
      },
      {
        heading: "Removal in exceptional circumstances",
        paragraphs: [
          "In rare cases, such as a court order, a serious risk to someone's privacy or safety, or defamatory content, it may be necessary to remove the text of an article. Even then, the bibliographic metadata and a notice explaining that the content has been removed, and why where possible, remain in place, consistent with COPE and NISO guidance.",
        ],
      },
      {
        heading: "How to request a correction or report a concern",
        paragraphs: [
          `Email ${J.editorialEmail} with the article's DOI, a description of the error or concern, the location in the article (section, figure or table), and for corrections the proposed corrected text. Concerns about potential misconduct are handled as described in EP-G-06, the Publication Ethics & Research Integrity Statement. The identity of anyone raising a concern is kept confidential.`,
        ],
      },
    ],
    checklist: [
      "The article's DOI is included.",
      "The error or concern, and where it appears, is described precisely.",
      "For a correction, proposed corrected text is supplied.",
      "For a correction, all co-authors have been informed and agree.",
      "Any supporting evidence for a concern is attached.",
    ],
    faqs: [
      { q: "What is the difference between a corrigendum and an erratum?", a: "A corrigendum corrects an error made by the authors; an erratum corrects an error introduced by the publisher during production." },
      { q: "Is a retracted article deleted?", a: "No. It remains available, clearly marked as retracted, with a linked notice explaining the reason." },
      { q: "What is an expression of concern?", a: "A notice alerting readers to serious, unresolved doubts about an article while an investigation proceeds. It may later be withdrawn or followed by a correction or retraction." },
      { q: "I found an error in my own published article. What should I do?", a: `Email ${J.editorialEmail} with the DOI, the location of the error and the corrected text. Prompt self-correction is good practice.` },
      { q: "How will readers know an article has been corrected?", a: "The article page shows its post-publication status with a banner linking to every notice, and the notice also appears in the article's provenance record and verification timeline." },
    ],
    relatedGuides: ["guide-publication-ethics", "guide-formatting-citation"],
  },
};
