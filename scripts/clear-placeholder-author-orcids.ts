/**
 * One-off cleanup: the sample articles from the first seed listed their
 * made-up authors with made-up ORCID iDs. This removes exactly those
 * values from the author lists of articles and books. Each affected
 * article's galleyTemplateVersion is reset to 0 so the next galley
 * backfill re-renders its PDF/HTML/EPUB/JATS without the old iD
 * (this step runs before backfill-galleys in build-maintenance.ts).
 *
 * Any author ORCID not on the list below is left untouched.
 *
 * Usage:
 *   bun run scripts/clear-placeholder-author-orcids.ts
 */
import { db } from "../src/lib/db";

const PLACEHOLDER_ORCIDS = new Set([
  "0000-0002-1001-0010",
  "0000-0002-1001-0011",
  "0000-0002-1001-0012",
  "0000-0002-1001-0013",
  "0000-0002-1001-0014",
  "0000-0002-1001-0015",
  "0000-0002-2222-1111",
  "0000-0002-2222-1112",
  "0000-0002-3333-0001",
  "0000-0002-4444-0001",
  "0000-0002-5555-0001",
  "0000-0002-6666-0001",
  "0000-0002-7777-0001",
  "0000-0002-8888-0001",
  "0000-0002-9999-0001",
]);

const bare = (v: unknown) => String(v ?? "").trim().replace(/^https?:\/\/orcid\.org\//i, "");

/** Returns the cleaned JSON, or null when nothing changed or it can't be parsed. */
function strip(json: string): string | null {
  let list: unknown;
  try {
    list = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(list)) return null;
  let changed = false;
  for (const a of list) {
    if (a && typeof a === "object" && "orcid" in a && PLACEHOLDER_ORCIDS.has(bare((a as any).orcid))) {
      delete (a as any).orcid;
      changed = true;
    }
  }
  return changed ? JSON.stringify(list) : null;
}

async function main() {
  const filter = { OR: [...PLACEHOLDER_ORCIDS].map((o) => ({ authors: { contains: o } })) };

  const articles = await db.article.findMany({ where: filter, select: { id: true, authors: true } });
  let a = 0;
  for (const row of articles) {
    const next = strip(row.authors);
    if (next === null) continue;
    await db.article.update({ where: { id: row.id }, data: { authors: next, galleyTemplateVersion: 0 } });
    a++;
  }

  const books = await db.book.findMany({ where: filter, select: { id: true, authors: true } });
  let b = 0;
  for (const row of books) {
    const next = strip(row.authors);
    if (next === null) continue;
    await db.book.update({ where: { id: row.id }, data: { authors: next } });
    b++;
  }

  console.log(`Removed placeholder ORCID iDs from ${a} article(s) and ${b} book(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
