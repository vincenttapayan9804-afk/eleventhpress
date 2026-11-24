/**
 * Turns a Creative Commons licence code such as "CC BY-NC-SA 4.0 IGO" into the
 * parts a small licence badge needs. Anything that is not a CC code (for
 * example "All rights reserved") returns null, so a badge is never shown for a
 * licence we cannot recognise.
 */
export type CcLicence = {
  /** Licence elements in order, e.g. ["BY", "NC", "SA"]. */
  elements: ("BY" | "NC" | "ND" | "SA")[];
  /** Version number, e.g. "4.0", or null when the code gives none. */
  version: string | null;
  /** Jurisdiction or porting suffix, e.g. "IGO", or null. */
  suffix: string | null;
  /** The code in its clean display form, e.g. "CC BY-NC-SA 4.0 IGO". */
  label: string;
  /** The licence deed on creativecommons.org. */
  url: string;
};

const ELEMENTS = new Set(["BY", "NC", "ND", "SA"]);

export function parseCcLicence(code: string | null | undefined): CcLicence | null {
  if (!code) return null;
  const m = code.trim().toUpperCase().match(/^CC[ -]((?:BY|NC|ND|SA)(?:-(?:BY|NC|ND|SA))*)(?:[ -](\d\.\d))?(?:[ -]([A-Z]{2,5}))?$/);
  if (!m) return null;
  const elements = m[1].split("-").filter((e) => ELEMENTS.has(e)) as CcLicence["elements"];
  if (!elements.includes("BY")) return null;
  const version = m[2] ?? null;
  const suffix = m[3] ?? null;
  const slug = elements.join("-").toLowerCase();
  const url = `https://creativecommons.org/licenses/${slug}/${version ?? "4.0"}/${suffix ? `${suffix.toLowerCase()}/` : ""}`;
  return {
    elements,
    version,
    suffix,
    label: `CC ${elements.join("-")}${version ? ` ${version}` : ""}${suffix ? ` ${suffix}` : ""}`,
    url,
  };
}
