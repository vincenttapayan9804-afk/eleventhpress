/**
 * Magazine issue distribution — same shape and same honesty pattern as
 * src/lib/book-distribution.ts. None of these platforms expose a public
 * bulk-publish API for a third party like this platform to submit against
 * (Apple News uses a closed publisher-partner program; Flipboard, Issuu,
 * and PressReader are all self-serve upload tools), so every platform here
 * is Tier B/C in the same sense book distribution uses those tiers: a real,
 * prefilled metadata package generated from the issue, a human finishes the
 * actual submission on the platform's own site.
 */
import { APP_BASE_URL } from "@/lib/site";

export type MagazineDistributionTier = "B" | "C";

export interface MagazineDistributionPlatform {
  id: string;
  label: string;
  tier: MagazineDistributionTier;
  postingHint: string;
  coverage?: string;
  consentText?: string;
  submitUrl?: string;
}

export const MAGAZINE_PLATFORMS: MagazineDistributionPlatform[] = [
  {
    id: "ISSUU",
    label: "Issuu",
    tier: "B",
    postingHint: "Continue to Issuu, upload the issue's PDF, then paste in the prefilled metadata below.",
    coverage: "Digital newsstand + embeddable flipbook reader.",
    consentText: "I confirm I hold full distribution rights to this issue and am authorized to publish it on Issuu.",
    submitUrl: "https://issuu.com/home/publications/new",
  },
  {
    id: "PRESSREADER",
    label: "PressReader",
    tier: "B",
    postingHint: "Continue to PressReader's publisher portal, submit the issue's PDF, then paste in the prefilled metadata below.",
    coverage: "Library/kiosk syndication network for magazines and newspapers.",
    consentText: "I confirm I hold full distribution rights to this issue and am authorized to publish it through PressReader.",
    submitUrl: "https://www.pressreader.com/publishers",
  },
  {
    id: "FLIPBOARD",
    label: "Flipboard",
    tier: "C",
    postingHint: "Create or update the magazine's Flipboard profile and add this issue's pieces manually, using the metadata below.",
  },
  {
    id: "APPLE_NEWS",
    label: "Apple News",
    tier: "C",
    postingHint: "Apple News Format publishing requires a separate Apple News Publisher account; use the metadata below when setting up that submission.",
  },
];

export function getMagazinePlatform(id: string): MagazineDistributionPlatform | undefined {
  return MAGAZINE_PLATFORMS.find((p) => p.id === id);
}

interface IssueForPackage {
  id: string;
  title: string | null;
  volume: number;
  issueNumber: number;
  year: number;
  theme?: string | null;
  magazineName: string;
  magazineDescription: string;
}

export interface MagazineDistributionPackage {
  magazineName: string;
  issueTitle: string;
  theme: string | null;
  description: string;
  canonicalUrl: string;
}

/**
 * Builds the prefilled Tier B submission package (Issuu/PressReader) and
 * doubles as the Tier C metadata reference (Flipboard/Apple News). Pure
 * function — no DB/network access — same shape as buildBookPackage.
 */
export function buildMagazinePackage(issue: IssueForPackage): MagazineDistributionPackage {
  const issueTitle = issue.title || `Vol. ${issue.volume}, No. ${issue.issueNumber} (${issue.year})`;
  return {
    magazineName: issue.magazineName,
    issueTitle,
    theme: issue.theme || null,
    description: issue.magazineDescription.trim(),
    canonicalUrl: `${APP_BASE_URL}/magazine/${issue.id}`,
  };
}
