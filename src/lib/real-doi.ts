import { PLACEHOLDER_DOI_PREFIX } from "@/lib/site";

/**
 * A DOI is "real" only when it can resolve at doi.org: it is registered or
 * published, and it is not one of our internal placeholders (the 10.5072 test
 * prefix, or a draft / correction-notice stand-in). Used to decide whether a
 * public "permanent link" may be shown.
 */
export function realDoi(doi: string | null | undefined, doiStatus: string | null | undefined): string | null {
  const d = (doi || "").trim();
  if (!d || !/^10\.\d{4,9}\/\S+$/.test(d)) return null;
  if (doiStatus !== "REGISTERED" && doiStatus !== "PUBLISHED") return null;
  const lower = d.toLowerCase();
  if (lower.startsWith("10.5072/") || lower.startsWith(`${PLACEHOLDER_DOI_PREFIX.toLowerCase()}/`)) return null;
  if (lower.includes(".draft.") || lower.includes(".correction.")) return null;
  return d;
}
