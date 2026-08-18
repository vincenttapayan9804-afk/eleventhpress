/**
 * Reference-manager interop (Tier 3) — the inverse of citation-export.ts's
 * buildBibTeXExternal: lets a researcher paste a .bib file exported from
 * Zotero/Mendeley/EndNote/etc. straight into the Gap Finder or PRISMA
 * drafting tool's external-sources list, instead of retyping each
 * citation by hand. Only entries that carry a real url or doi field are
 * importable — an external source needs a live URL for this platform to
 * actually fetch and read it (see research-gap-finder.ts's resolveExternalSource),
 * so a citation with neither is reported as skipped rather than silently
 * dropped or given a fabricated URL.
 */
export interface ParsedBibEntry {
  url: string;
  title?: string;
  authors?: string;
  year?: number | null;
  venue?: string | null;
}

export interface BibTeXImportResult {
  entries: ParsedBibEntry[];
  skipped: { key: string; reason: string }[];
}

function stripBraces(v: string): string {
  return v.trim().replace(/^[{"]+|[}"]+$/g, "").replace(/\s+/g, " ").trim();
}

/** Splits "Last, First and Last2, First2" / "First Last and First2 Last2"
 * BibTeX author lists into the "A, B, C" free-text form the rest of this
 * platform's citation tooling expects (see citation-export.ts). */
function normalizeAuthors(raw: string): string {
  return raw
    .split(/\s+and\s+/i)
    .map((a) => a.trim())
    .filter(Boolean)
    .join(", ");
}

/** Parses the flat "field = {value}," body of one BibTeX entry into a map. */
function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  // Matches `key = {balanced-braced value}` or `key = "value"` or `key = 123`
  const re = /(\w+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    fields[m[1].toLowerCase()] = stripBraces(m[2]);
  }
  return fields;
}

/**
 * Parses raw BibTeX text into external-source entries. Best-effort: unlike
 * a full BibTeX library this doesn't handle string macros (@string) or
 * crossref inheritance — real-world exports from major reference managers
 * (Zotero, Mendeley, EndNote) don't use either, so this covers the actual
 * import case without pulling in a new dependency.
 */
export function parseBibTeX(raw: string): BibTeXImportResult {
  const entries: ParsedBibEntry[] = [];
  const skipped: { key: string; reason: string }[] = [];

  const entryRe = /@(\w+)\s*\{\s*([^,]+),([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  let found = 0;
  while ((m = entryRe.exec(raw))) {
    found++;
    const [, , keyRaw, body] = m;
    const key = keyRaw.trim();
    const fields = parseFields(body);
    const url = fields.url || (fields.doi ? `https://doi.org/${fields.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}` : "");
    if (!url) {
      skipped.push({ key, reason: "No url or doi field — nothing to fetch" });
      continue;
    }
    const yearNum = fields.year ? parseInt(fields.year, 10) : NaN;
    entries.push({
      url,
      title: fields.title || undefined,
      authors: fields.author ? normalizeAuthors(fields.author) : undefined,
      year: Number.isFinite(yearNum) ? yearNum : null,
      venue: fields.journal || fields.booktitle || fields.publisher || null,
    });
  }
  if (found === 0 && raw.trim()) {
    skipped.push({ key: "(file)", reason: "No @entry{...} blocks found — is this valid BibTeX?" });
  }
  return { entries, skipped };
}
