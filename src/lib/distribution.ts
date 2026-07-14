/**
 * Article syndication ("Distribution") — Tier C (Phase 1) and Tier B
 * (Phase 2) of the multi-platform publishing expansion.
 *
 * Tier C platforms have no public submission API for third parties at all;
 * the achievable automation is generating a ready-to-post "share kit"
 * (blurb + repurposed excerpt + canonical backlink) and letting the
 * author/editor self-report once they've posted it manually.
 *
 * Tier B platforms (arXiv, SSRN) DO have a real submission flow, but not
 * one EPIP can complete on the author's behalf: both require the actual
 * account holder to click submit, and — more importantly — posting a
 * preprint is a decision with real consequences (some venues restrict or
 * forbid preprinting; SSRN/arXiv have their own moderation policies). So
 * Tier B never auto-submits. It generates a structured, prefilled
 * submission package (title/authors/abstract/category, formatted per that
 * platform's convention) and a link to that platform's own submission
 * start page, gated behind an explicit author consent checkbox recorded on
 * the Distribution row (`authorConsent`/`consentedAt`) — no package is
 * generated until the author affirms they have the right to preprint this
 * work and that their journal agreement permits it.
 *
 * Tier A (Blogger) is true API automation — once an author connects their
 * Google account (src/lib/blogger.ts), POST /api/distribution for that
 * platform genuinely publishes the post via the Blogger API and marks the
 * row LIVE immediately. No package, no consent checkbox, no self-reported
 * status — the only Tier A here.
 */
import { parseAuthors } from "@/lib/article";
import { APP_BASE_URL } from "@/lib/site";

// Local, dependency-free HTML escaper — deliberately not imported from
// src/lib/galley.ts's escapeXml, since this module is imported by a client
// component (distribution-tab.tsx) and galley.ts pulls in server-only PDF
// libraries (pdfkit/fontkit/fs) that break the client bundle.
function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export type DistributionTier = "A" | "B" | "C";

export interface DistributionPlatform {
  id: string;
  label: string;
  tier: DistributionTier;
  /** Short instructions shown to the author for how to actually post the kit. */
  postingHint: string;
  /** Tier B only — the affirmation the author must check before a package is generated. */
  consentText?: string;
  /** Tier B only — where the author continues to actually submit, once they have the package. */
  submitUrl?: string;
}

export const PLATFORMS: DistributionPlatform[] = [
  // Tier C — no public submission API for third parties. ResearchGate/
  // Academia.edu/HubPages have none at all; Substack/Medium have no API
  // open to new integrations; LinkedIn Articles requires partner approval
  // EPIP doesn't have yet, so it's treated as Tier C until/unless obtained.
  { id: "RESEARCHGATE", label: "ResearchGate", tier: "C", postingHint: "Upload the article PDF as a new publication on your ResearchGate profile, then paste the blurb below as the description." },
  { id: "ACADEMIA_EDU", label: "Academia.edu", tier: "C", postingHint: "Upload the article PDF to Academia.edu and paste the blurb as the paper summary." },
  { id: "SUBSTACK", label: "Substack", tier: "C", postingHint: "Paste the repurposed excerpt into a new Substack post; keep the canonical link visible near the top." },
  { id: "MEDIUM", label: "Medium", tier: "C", postingHint: "Paste the repurposed excerpt into a new Medium story; Medium's own canonical-URL field should point back to the article link below." },
  { id: "LINKEDIN", label: "LinkedIn Articles", tier: "C", postingHint: "Paste the blurb into a new LinkedIn article or post, linking back to the article." },
  { id: "HUBPAGES", label: "HubPages", tier: "C", postingHint: "Paste the repurposed excerpt into a new HubPages article, linking back to the article." },

  // Tier B — real submission flow, consent-gated prefilled package.
  {
    id: "ARXIV",
    label: "arXiv",
    tier: "B",
    postingHint: "Continue to arXiv's submission form, then paste in the prefilled title/abstract/category below and upload the article PDF.",
    consentText: "I confirm I hold the right to distribute this work as a preprint, and that my agreement with this journal permits posting a preprint version to arXiv.",
    submitUrl: "https://arxiv.org/submit",
  },
  {
    id: "SSRN",
    label: "SSRN",
    tier: "B",
    postingHint: "Continue to SSRN, start a new submission from your account, then paste in the prefilled title/abstract below and upload the article PDF.",
    consentText: "I confirm I hold the right to distribute this work as a working paper, and that my agreement with this journal permits posting a preprint version to SSRN.",
    submitUrl: "https://www.ssrn.com/",
  },

  // Tier A — true API automation. Connect once, then every "Publish"
  // click here genuinely posts to the author's own blog with no further
  // human action required.
  { id: "BLOGGER", label: "Blogger", tier: "A", postingHint: "Connect your Google account once, then publish directly — no copy-pasting required." },
];

export function getPlatform(id: string): DistributionPlatform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

// Coarse discipline -> arXiv primary-category mapping, covering the
// disciplines this platform actually publishes today. arXiv's own category
// taxonomy is much finer-grained than a single free-text `discipline`
// field can express, so this is a starting suggestion for the author to
// refine on arXiv's own form, not a binding classification.
const ARXIV_CATEGORY_MAP: Record<string, string> = {
  physics: "physics.gen-ph",
  mathematics: "math.GM",
  "computer science": "cs.GL",
  biology: "q-bio.GN",
  economics: "econ.GN",
  statistics: "stat.AP",
};

export function guessArxivCategory(discipline: string): string | null {
  return ARXIV_CATEGORY_MAP[discipline.trim().toLowerCase()] || null;
}

interface ArticleForKit {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  discipline: string;
  keywords?: string;
  doi?: string | null;
  laySummary?: string | null;
  journalName?: string;
}

export interface ShareKit {
  blurb: string;
  excerpt: string;
  canonicalUrl: string;
}

/**
 * Builds the share-kit text for a Tier C platform. Pure function — no DB or
 * network access — so it's directly unit-testable and safe to call from an
 * API route without side effects until the caller decides to persist it.
 *
 * Uses the AI-generated lay summary when available (src/lib/manuscript-checks.ts
 * already produces one, optionally, pre-publication) since a plain-language
 * summary reads far better on a general platform than the academic abstract,
 * and repurposing rather than reposting the raw abstract also avoids an
 * exact-duplicate-content footprint across platforms.
 */
export function buildShareKit(article: ArticleForKit): ShareKit {
  const authors = parseAuthors(article.authors);
  const authorNames = authors.map((a) => a.name).filter(Boolean).join(", ") || "the authors";
  const canonicalUrl = `${APP_BASE_URL}/article/${article.id}`;
  const summary = (article.laySummary || article.abstract).trim();

  const blurb = `${article.title}\n\nBy ${authorNames}${article.journalName ? ` — published in ${article.journalName}` : ""}.\n\n${summary}\n\nRead the full article: ${canonicalUrl}`;

  const excerpt = `## ${article.title}\n\n*By ${authorNames}*\n\n${summary}\n\n*Originally published in ${article.journalName || "Eleventh Press International Publishing"} (${article.discipline}). Read the full peer-reviewed article: [${canonicalUrl}](${canonicalUrl})*`;

  return { blurb, excerpt, canonicalUrl };
}

export interface SubmissionPackage {
  title: string;
  authors: string; // "Name (Affiliation); Name (Affiliation)"
  abstract: string;
  keywords: string;
  suggestedCategory: string | null;
  comment: string; // journal-reference-style note, e.g. arXiv's "Comments" field
  canonicalUrl: string;
}

/**
 * Builds the prefilled Tier B submission package (arXiv/SSRN). Same
 * pure-function shape as buildShareKit — no DB/network access, safe to unit
 * test directly. Callers are responsible for enforcing author consent
 * before calling this; the function itself has no side effects and doesn't
 * know about consent state.
 */
export function buildSubmissionPackage(article: ArticleForKit, platformId: string): SubmissionPackage {
  const authors = parseAuthors(article.authors);
  const authorList = authors.map((a) => (a.affiliation ? `${a.name} (${a.affiliation})` : a.name)).join("; ") || "the authors";
  const canonicalUrl = `${APP_BASE_URL}/article/${article.id}`;
  const journalName = article.journalName || "Eleventh Press International Publishing";

  return {
    title: article.title,
    authors: authorList,
    abstract: article.abstract.trim(),
    keywords: article.keywords || article.discipline,
    suggestedCategory: platformId === "ARXIV" ? guessArxivCategory(article.discipline) : null,
    comment: `Published in ${journalName}${article.doi ? `, DOI: ${article.doi}` : ""}. Version of record: ${canonicalUrl}`,
    canonicalUrl,
  };
}

export interface BloggerPost {
  title: string;
  html: string;
}

/**
 * Builds the HTML post body for the Tier A Blogger auto-publish. Pure
 * function — no DB/network access — so it's directly unit-testable.
 */
export function buildBloggerPost(article: ArticleForKit): BloggerPost {
  const authors = parseAuthors(article.authors);
  const authorNames = authors.map((a) => a.name).filter(Boolean).join(", ") || "the authors";
  const canonicalUrl = `${APP_BASE_URL}/article/${article.id}`;
  const summary = (article.laySummary || article.abstract).trim();
  const journalName = article.journalName || "Eleventh Press International Publishing";

  const html = [
    `<p><em>By ${escapeHtml(authorNames)} — published in ${escapeHtml(journalName)}</em></p>`,
    `<p>${escapeHtml(summary)}</p>`,
    `<p><a href="${canonicalUrl}">Read the full peer-reviewed article</a></p>`,
  ].join("\n");

  return { title: article.title, html };
}
