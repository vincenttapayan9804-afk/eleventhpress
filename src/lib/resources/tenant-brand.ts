/**
 * Who the Resources guides speak for on the site being viewed.
 *
 * The official guides describe the publishing workflow every site on the
 * platform runs, so a whitelabel tenant shows them under its own name: its
 * publisher name, editorial email, ISSN, address and site URL replace
 * Eleventh Press's, on the web page and in the PDF edition. The Resources
 * blog is Eleventh Press's own editorial writing and is not shown on tenant
 * sites at all (see resourcesBlogVisible).
 */
import { APP_BASE_URL, JOURNAL_IDENTITY, ISSN_PENDING_LABEL } from "@/lib/site";

export interface ResourceBrand {
  whitelabel: boolean;
  /** Organisation the guides are issued by ("Ron International Publishing"). */
  publisher: string;
  /** Short name used in running text ("Ron International Publishing"). */
  shortName: string;
  /** Journal title, for the platform journal's full name in the text. */
  journalName: string;
  /** Editorial contact, or null when the tenant has none configured. */
  email: string | null;
  issn: string | null;
  location: string | null;
  /** Site the guides live on, without a trailing slash. */
  baseUrl: string;
  /** Logo for structured data. */
  logoUrl: string;
  primaryHex: string;
  accentHex: string;
}

export const PLATFORM_RESOURCE_BRAND: ResourceBrand = Object.freeze({
  whitelabel: false,
  publisher: JOURNAL_IDENTITY.name,
  shortName: JOURNAL_IDENTITY.shortName,
  journalName: JOURNAL_IDENTITY.name,
  email: JOURNAL_IDENTITY.editorialEmail,
  issn: JOURNAL_IDENTITY.issn,
  location: JOURNAL_IDENTITY.location,
  baseUrl: APP_BASE_URL.replace(/\/+$/, ""),
  logoUrl: `${APP_BASE_URL.replace(/\/+$/, "")}/logo.svg`,
  primaryHex: "#4c1d95",
  accentHex: "#c9a55c",
}) as ResourceBrand;

/** "ISSN 1234-5678 · Manila · editor@x.org": only the parts a tenant has set. */
export function brandContactLine(b: ResourceBrand): string {
  const issn = b.issn ? `ISSN ${b.issn}` : b.whitelabel ? null : ISSN_PENDING_LABEL;
  return [issn, b.location, b.email].filter(Boolean).join(" · ");
}

/** A guide code as shown on this site: tenants drop the "EP-" (Eleventh Press) prefix. */
export function brandCode(code: string, b: ResourceBrand): string {
  return b.whitelabel ? code.replace(/^EP-/, "") : code;
}

/** Rewrites Eleventh Press's identity in a piece of guide text to the site's own. */
export function brandText(text: string, b: ResourceBrand): string {
  if (!b.whitelabel || !text) return text;
  return text
    .replace(/Eleventh Press International Journal of Multidisciplinary Research/g, b.journalName)
    .replace(/Eleventh Press International Publishing(?:™|\(TM\))?/g, b.publisher)
    .replace(/Eleventh Press/g, b.shortName)
    .replace(/\bEPIP\b/g, b.shortName)
    .replace(/\b[a-z0-9._-]+@eleventhpress\.com\b/gi, b.email ?? "the editorial office")
    .replace(/https?:\/\/(?:www\.)?eleventhpress\.com/gi, b.baseUrl)
    .replace(/\bEP-([GF])-(\d+)\b/g, "$1-$2");
}

/** brandText applied to every string inside a guide (or any plain data). */
export function brandDeep<T>(value: T, b: ResourceBrand): T {
  if (!b.whitelabel) return value;
  if (typeof value === "string") return brandText(value, b) as T;
  if (Array.isArray(value)) return value.map((v) => brandDeep(v, b)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // External links (standards, references) are never ours to rewrite.
      out[k] = k === "url" ? v : brandDeep(v, b);
    }
    return out as T;
  }
  return value;
}
