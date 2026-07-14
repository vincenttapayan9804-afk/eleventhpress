/**
 * Article syndication ("Distribution") — Phase 1 of the multi-platform
 * publishing expansion. Only Tier C platforms are wired up here: those with
 * no public bulk-upload API, where the achievable automation is generating
 * a ready-to-post "share kit" (blurb + repurposed excerpt + canonical
 * backlink) and letting the author/editor self-report once they've posted
 * it manually. Tiers A (true API publish, e.g. Blogger) and B (arXiv/SSRN/
 * ERIC prefilled submission packages, which require an explicit author
 * consent + preprint-policy step) are later phases — see the plan file for
 * the full rollout order. Adding a Tier A/B platform later only means
 * adding an entry to PLATFORMS and a new generator branch; the Distribution
 * model and API routes are already shaped to support all three tiers.
 */
import { parseAuthors } from "@/lib/article";
import { APP_BASE_URL } from "@/lib/site";

export type DistributionTier = "A" | "B" | "C";

export interface DistributionPlatform {
  id: string;
  label: string;
  tier: DistributionTier;
  /** Short instructions shown to the author for how to actually post the kit. */
  postingHint: string;
}

// Phase 1 — Tier C only. ResearchGate/Academia.edu/HubPages have no public
// submission API for third parties; Substack/Medium have no API open to new
// integrations; LinkedIn Articles requires partner approval EPIP doesn't
// have yet, so it's treated as Tier C until/unless that's obtained.
export const PLATFORMS: DistributionPlatform[] = [
  { id: "RESEARCHGATE", label: "ResearchGate", tier: "C", postingHint: "Upload the article PDF as a new publication on your ResearchGate profile, then paste the blurb below as the description." },
  { id: "ACADEMIA_EDU", label: "Academia.edu", tier: "C", postingHint: "Upload the article PDF to Academia.edu and paste the blurb as the paper summary." },
  { id: "SUBSTACK", label: "Substack", tier: "C", postingHint: "Paste the repurposed excerpt into a new Substack post; keep the canonical link visible near the top." },
  { id: "MEDIUM", label: "Medium", tier: "C", postingHint: "Paste the repurposed excerpt into a new Medium story; Medium's own canonical-URL field should point back to the article link below." },
  { id: "LINKEDIN", label: "LinkedIn Articles", tier: "C", postingHint: "Paste the blurb into a new LinkedIn article or post, linking back to the article." },
  { id: "HUBPAGES", label: "HubPages", tier: "C", postingHint: "Paste the repurposed excerpt into a new HubPages article, linking back to the article." },
];

export function getPlatform(id: string): DistributionPlatform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

interface ArticleForKit {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  discipline: string;
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
