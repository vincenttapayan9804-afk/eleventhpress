/**
 * Book distribution — Phase 4 of the multi-platform publishing expansion.
 * Covers the 7 book-distributor platforms from the plan: Amazon KDP,
 * Barnes & Noble Press, IngramSpark, Apple Books, Lulu, Draft2Digital,
 * Smashwords.
 *
 * Draft2Digital and IngramSpark are themselves aggregators — one
 * Draft2Digital submission reaches Apple Books, Barnes & Noble, Kobo, and
 * Smashwords's own storefront; IngramSpark covers print-on-demand plus wide
 * ebook distribution to libraries and retailers. Integrating with just
 * those two covers most of the 7-platform list, so they're Tier B (real
 * submission flow, prefilled metadata package, human clicks submit — same
 * treatment and same rationale as arXiv/SSRN in src/lib/distribution.ts).
 *
 * Amazon KDP and Lulu have no public API for third-party bulk publishing,
 * so they're Tier C (share-kit/manual, self-reported) — same shape as
 * ResearchGate/Academia.edu in the article distribution tier.
 *
 * Unlike article Tier B, a book package requires a finished, real EPUB/PDF
 * (the book must already be PUBLISHED with epubKey+pdfKey present) since
 * these are full-manuscript distributors, never per-article.
 */
import { APP_BASE_URL } from "@/lib/site";

export type BookDistributionTier = "B" | "C";

export interface BookDistributionPlatform {
  id: string;
  label: string;
  tier: BookDistributionTier;
  postingHint: string;
  /** What this platform additionally reaches, for aggregator platforms. */
  coverage?: string;
  /** Tier B only — the affirmation the author must check before a package is generated. */
  consentText?: string;
  /** Tier B only — where the author continues to actually submit. */
  submitUrl?: string;
}

export const BOOK_PLATFORMS: BookDistributionPlatform[] = [
  {
    id: "DRAFT2DIGITAL",
    label: "Draft2Digital",
    tier: "B",
    postingHint: "Continue to Draft2Digital, start a new book, then paste in the prefilled metadata below and upload the EPUB.",
    coverage: "Reaches Apple Books, Barnes & Noble, Kobo, and Smashwords's storefront from this one submission.",
    consentText: "I confirm I hold full distribution rights to this book and am authorized to publish it across the retailers Draft2Digital distributes to.",
    submitUrl: "https://draft2digital.com/book/new",
  },
  {
    id: "INGRAMSPARK",
    label: "IngramSpark",
    tier: "B",
    postingHint: "Continue to IngramSpark, create a new title, then paste in the prefilled metadata below and upload the print-ready PDF and EPUB.",
    coverage: "Print-on-demand plus wide ebook distribution to libraries, retailers, and independent bookstores.",
    consentText: "I confirm I hold full distribution rights to this book and am authorized to publish it, including print-on-demand, through IngramSpark.",
    submitUrl: "https://www.ingramspark.com/",
  },
  {
    id: "AMAZON_KDP",
    label: "Amazon KDP",
    tier: "C",
    postingHint: "Upload the EPUB and cover to Kindle Direct Publishing manually, then paste the metadata below into the title's details.",
  },
  {
    id: "LULU",
    label: "Lulu",
    tier: "C",
    postingHint: "Upload the print-ready PDF and cover to Lulu's self-serve print-on-demand tool, then paste the metadata below into the title's details.",
  },
];

export function getBookPlatform(id: string): BookDistributionPlatform | undefined {
  return BOOK_PLATFORMS.find((p) => p.id === id);
}

interface BookForPackage {
  id: string;
  title: string;
  subtitle?: string | null;
  authors: string; // JSON array of {name, affiliation, orcid, email}
  description: string;
  category: string;
  isbn?: string | null;
  price?: number | null;
}

export interface BookDistributionPackage {
  title: string;
  subtitle: string | null;
  authors: string; // "Name; Name"
  description: string;
  category: string;
  isbn: string | null;
  price: number;
  keywords: string;
  canonicalUrl: string;
}

/**
 * Builds the prefilled Tier B submission package (Draft2Digital/
 * IngramSpark) and doubles as the Tier C metadata reference (Amazon KDP/
 * Lulu). Pure function — no DB or network access — so it's directly
 * unit-testable and safe to call before the caller decides to persist it.
 * Callers are responsible for enforcing author consent (Tier B) and for
 * confirming the book actually has a finished epubKey/pdfKey before
 * offering this — this function itself has no side effects and doesn't
 * know about either.
 */
export function buildBookPackage(book: BookForPackage): BookDistributionPackage {
  let authorNames = "the authors";
  try {
    const parsed = JSON.parse(book.authors) as { name?: string }[];
    const names = parsed.map((a) => a.name).filter(Boolean);
    if (names.length > 0) authorNames = names.join("; ");
  } catch {}

  return {
    title: book.title,
    subtitle: book.subtitle || null,
    authors: authorNames,
    description: book.description.trim(),
    category: book.category,
    isbn: book.isbn || null,
    price: book.price ?? 0,
    keywords: book.category,
    canonicalUrl: `${APP_BASE_URL}/book/${book.id}`,
  };
}
