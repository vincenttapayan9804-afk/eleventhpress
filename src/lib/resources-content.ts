
/**
 * Shared source of truth for the Resources page's static content (guides,
 * blogs, trainings, webinars, curated books) — extracted from
 * resources-view.tsx so both the UI and the server-side search route
 * (src/app/api/resources/search/route.ts, and the Meilisearch sync it
 * triggers) read from the exact same data instead of two copies drifting
 * apart.
 */

export interface Reading {
  id: string;
  /** URL segment: /resources/blog/<slug>. */
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  /** ISO dates. */
  datePublished: string;
  dateModified: string;
  readMinutes: number;
  meta: string;
}

const EDITORIAL = "Editorial Office";
const REVISED = "2026-11-06";

function reading(r: Omit<Reading, "meta" | "dateModified"> & { dateModified?: string }): Reading {
  return { ...r, dateModified: r.dateModified ?? r.datePublished, meta: `${EDITORIAL} · ${r.readMinutes} min read` };
}

/**
 * Catalog of the Resources blog. Full text (top-10 takeaways, sections,
 * FAQs, references) lives in src/lib/resources/blog-posts.ts, which only the
 * server-rendered /resources/blog/[slug] page imports; readMinutes is
 * checked against that text by resources-content.test.ts.
 */
export const BLOGS: Reading[] = [
  reading({
    id: "blog-syndication-network",
    slug: "beyond-the-doi-multidisciplinary-syndication-network",
    title: "Beyond the DOI: Inside Our Multidisciplinary Syndication Network",
    excerpt: "Publication used to be the finish line. How a published, DOI-registered article is disseminated across eight platforms without diluting the version of record.",
    category: "Dissemination & Open Scholarship",
    datePublished: REVISED,
    readMinutes: 7,
  }),
  reading({
    id: "blog-book-division",
    slug: "from-articles-to-book-academic-publishing-division",
    title: "Your Articles, Now a Book: How Our Publishing Division Works",
    excerpt: "Compile an edited volume from your published work or submit a new monograph: the editorial, production and distribution standards behind both routes.",
    category: "Books & Long-Form Scholarship",
    datePublished: REVISED,
    readMinutes: 6,
  }),
  reading({
    id: "blog-multidisciplinary-standards",
    slug: "editorial-standards-for-multidisciplinary-research",
    title: "Why Multidisciplinary Research Needs Its Own Editorial Standards",
    excerpt: "Single-discipline review checklists break down when a manuscript spans three fields. Component-matched review, reporting guidelines and editorial synthesis explained.",
    category: "Peer Review & Editorial Practice",
    datePublished: REVISED,
    readMinutes: 6,
  }),
  reading({
    id: "blog-apc-explained",
    slug: "article-processing-charge-explained",
    title: "Demystifying the APC: What You're Actually Paying For",
    excerpt: "What an article processing charge funds, when it is charged, how it is firewalled from editorial decisions, and how to recognise a fair and transparent fee.",
    category: "Open Access Economics",
    datePublished: REVISED,
    readMinutes: 6,
  }),
  reading({
    id: "blog-double-blind-review",
    slug: "double-blind-peer-review-plain-language-guide",
    title: "A Plain-Language Guide to Double-Blind Peer Review",
    excerpt: "What double-anonymised review hides, what the evidence says about reviewer bias, how to anonymise a manuscript properly, and when other review models fit better.",
    category: "Peer Review & Editorial Practice",
    datePublished: REVISED,
    readMinutes: 6,
  }),
  reading({
    id: "blog-open-access-licensing",
    slug: "open-access-licensing-cc-by-explained",
    title: "Open Access Licensing, Explained Without the Legalese",
    excerpt: "CC BY 4.0 in one sentence, the six Creative Commons licences compared, copyright retention, third-party material and what funder mandates actually require.",
    category: "Open Access & Copyright",
    datePublished: REVISED,
    readMinutes: 6,
  }),
  reading({
    id: "blog-reviewer-matching",
    slug: "how-editors-match-reviewers-to-manuscripts",
    title: "How Editors Actually Match Reviewers to Manuscripts",
    excerpt: "Expertise matching, conflict-of-interest screening, reviewer workload and the 14-day window: the logic behind every peer-review invitation.",
    category: "Peer Review & Editorial Practice",
    datePublished: REVISED,
    readMinutes: 6,
  }),
  reading({
    id: "blog-reading-rejection",
    slug: "reading-your-rejection-letter-what-to-do-next",
    title: "Reading Your Rejection Letter: What to Do Next",
    excerpt: "How to decode an editorial decision, triage reviewer comments, decide where to resubmit and when (and how) to ask for a second read.",
    category: "Author Development",
    datePublished: REVISED,
    readMinutes: 6,
  }),
];

export interface Guide {
  id: string;
  /** URL segment: /resources/guides/<slug>. */
  slug: string;
  /** Controlled document code printed on the PDF edition. */
  code: string;
  title: string;
  summary: string;
  version: string;
  /** ISO date the current version took effect. */
  effective: string;
  /** ISO date of the next scheduled review. */
  nextReview: string;
  /** Short names of the standards the guide is benchmarked against. */
  benchmarks: string[];
}

function guide(g: Omit<Guide, "version" | "effective" | "nextReview">): Guide {
  return { ...g, version: "2.0", effective: REVISED, nextReview: "2027-11-06" };
}

/**
 * Catalog of the official guides. Full text and the benchmarked-standards
 * table live in src/lib/resources/guide-docs.ts (server-only); each guide
 * also has a branded PDF edition at /resources/guides/<slug>/pdf.
 */
export const GUIDES: Guide[] = [
  guide({
    id: "guide-author-submission",
    slug: "author-submission-guide",
    code: "EP-G-01",
    title: "Author Submission Guide",
    summary: "Everything required before you upload a manuscript: components, metadata, authorship, declarations, anonymisation, and every stage after you press submit.",
    benchmarks: ["ICMJE Recommendations", "COPE Core Practices", "CRediT (ANSI/NISO Z39.104-2022)", "EQUATOR reporting guidelines", "ORCID & ROR identifiers"],
  }),
  guide({
    id: "guide-formatting-citation",
    slug: "formatting-and-citation-style-guide",
    code: "EP-G-02",
    title: "Formatting & Citation Style Guide",
    summary: "Manuscript structure, house style, references, figures, tables, units and accessibility, and how your file becomes a typeset PDF, HTML and JATS XML article.",
    benchmarks: ["APA 7th edition", "JATS (ANSI/NISO Z39.96)", "SI Brochure (BIPM)", "ISO 8601", "WCAG 2.2"],
  }),
  guide({
    id: "guide-reviewer-handbook",
    slug: "reviewer-handbook",
    code: "EP-G-03",
    title: "Reviewer Handbook",
    summary: "How to accept an invitation, write a constructive and evidence-based report, apply the 1–5 scoring rubric and recommendations, and meet the 14-day window.",
    benchmarks: ["COPE Ethical Guidelines for Peer Reviewers", "ANSI/NISO Z39.106-2023", "ICMJE Recommendations", "EQUATOR reporting guidelines"],
  }),
  guide({
    id: "guide-apc-waiver",
    slug: "apc-waiver-request-guide",
    code: "EP-G-04",
    title: "APC Waiver Request Guide",
    summary: "Who can request a full or partial waiver of the USD 97 APC, how to apply, how requests are assessed, and how they are kept separate from editorial decisions.",
    benchmarks: ["Principles of Transparency & Best Practice (COPE/DOAJ/OASPA/WAME)", "Plan S Principles", "World Bank income classifications", "Research4Life eligibility"],
  }),
  guide({
    id: "guide-data-code-availability",
    slug: "data-and-code-availability-guide",
    code: "EP-G-05",
    title: "Data & Code Availability Guide",
    summary: "Writing a data availability statement, choosing a repository, licensing and citing datasets and software, and handling sensitive data, the FAIR way.",
    benchmarks: ["FAIR Guiding Principles", "Joint Declaration of Data Citation Principles", "FORCE11 Software Citation Principles", "TOP Guidelines", "CARE Principles"],
  }),
  guide({
    id: "guide-publication-ethics",
    slug: "publication-ethics-and-research-integrity",
    code: "EP-G-06",
    title: "Publication Ethics & Research Integrity Statement",
    summary: "Our COPE- and ICMJE-aligned policy on authorship, AI tools, plagiarism, data and image integrity, conflicts of interest, ethical oversight and reporting a concern.",
    benchmarks: ["COPE Core Practices", "ICMJE Recommendations", "Declaration of Helsinki (2024)", "European Code of Conduct for Research Integrity", "Singapore Statement"],
  }),
  guide({
    id: "guide-corrections-retractions",
    slug: "corrections-retractions-and-expressions-of-concern",
    code: "EP-G-07",
    title: "Corrections, Retractions & Expressions of Concern Guide",
    summary: "What each post-publication notice means, when it is used, how it is issued and linked to the original article, and how to request a correction or report a concern.",
    benchmarks: ["COPE Retraction Guidelines", "NISO RP-45-2024 (CREC)", "ICMJE Recommendations", "NISO RP-8-2008 (Journal Article Versions)"],
  }),
];

export interface Book {
  id: string;
  title: string;
  author: string;
  note: string;
}

export const BOOKS: Book[] = [
  { id: "book-craft-of-research", title: "The Craft of Research", author: "Wayne C. Booth, Gregory G. Colomb, Joseph M. Williams & Joseph Bizup", note: "The standard reference for turning a research question into an argument a reader can follow." },
  { id: "book-write-a-lot", title: "How to Write a Lot: A Practical Guide to Productive Academic Writing", author: "Paul J. Silvia", note: "Short, practical, and aimed squarely at the habit of writing rather than motivation or talent." },
  { id: "book-writing-science", title: "Writing Science: How to Write Papers That Get Cited and Proposals That Get Funded", author: "Joshua Schimel", note: "Frames every paper as a story with a problem and a resolution — useful across disciplines, not just the sciences." },
  { id: "book-chicago-guide-science", title: "The Chicago Guide to Communicating Science", author: "Scott L. Montgomery", note: "Strong on translating technical findings for readers outside your immediate subfield." },
  { id: "book-stylish-academic-writing", title: "Stylish Academic Writing", author: "Helen Sword", note: "A readable argument against unnecessarily dense academic prose, backed by analysis of published writing." },
  { id: "book-elements-of-style", title: "The Elements of Style", author: "William Strunk Jr. & E. B. White", note: "The classic, still-relevant primer on clear sentence-level writing." },
];

export interface Planned {
  id: string;
  title: string;
  blurb: string;
}

export const TRAININGS: Planned[] = [
  { id: "training-systematic-writing", title: "Systematic Manuscript Writing for Multidisciplinary Audiences", blurb: "Structuring a paper so reviewers outside your immediate subfield can still evaluate it fairly." },
  { id: "training-statistical-reporting", title: "Statistical Reporting & Reproducibility Essentials", blurb: "Common statistical reporting gaps that trigger revision requests, and how to avoid them upfront." },
  { id: "training-navigating-peer-review", title: "Navigating Peer Review: A Reviewer's Primer", blurb: "For first-time reviewers — what a useful, actionable review actually looks like." },
  { id: "training-research-data-management", title: "Research Data Management & FAIR Principles", blurb: "Making your data Findable, Accessible, Interoperable, and Reusable — and why funders increasingly require it." },
  { id: "training-preprint-to-publication", title: "From Preprint to Publication: A Practical Roadmap", blurb: "Deciding when and where to preprint, and how it interacts with journal submission." },
];

export const WEBINARS: Planned[] = [
  { id: "webinar-open-access-licensing", title: "Understanding Open Access & CC BY 4.0 Licensing", blurb: "What CC BY 4.0 actually permits, and how it interacts with funder mandates." },
  { id: "webinar-choosing-journal", title: "Choosing the Right Journal for Your Research", blurb: "Matching scope, audience, and venue reputation to your specific manuscript." },
  { id: "webinar-responding-to-reviewers", title: "Responding to Reviewer Comments Without Losing Your Mind", blurb: "A practical framework for triaging and responding to a major-revisions decision." },
  { id: "webinar-research-integrity", title: "Research Integrity: Avoiding Common Pitfalls", blurb: "Authorship disputes, duplicate submission, and other issues that are easy to avoid and hard to undo." },
  { id: "webinar-metrics-that-matter", title: "Metrics That Matter: Citations, Altmetrics & Impact", blurb: "Reading citation counts and altmetrics for what they actually measure — and what they don't." },
];
