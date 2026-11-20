/**
 * "Related work beyond this journal" for a Research Assistant answer: a
 * search of open scholarly indexes (src/lib/open-discovery.ts) built from
 * the reader's question and the cited articles' keywords.
 *
 * These results are never given to the model and never cited in the
 * answer, which stays grounded in the journal's own articles only. They are
 * a reading list shown on request, clearly labelled as outside the journal.
 */
import type { DiscoveryResult } from "@/lib/open-discovery";

const STOPWORDS = new Set(
  (
    "a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down " +
    "during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off " +
    "on once only or other our ours out over own same she should so some such than that the their theirs them then there these they this those through to too " +
    "under until up very was we were what when where which while who whom why will with would you your yours " +
    // question and research-assistant phrasing that carries no topic
    "according article articles author authors compare compared comparison describe discuss explain find findings found journal journals key " +
    "literature main overview paper papers please research say says show shows studies study summarise summarize summary tell think used using " +
    "what's whats"
  ).split(/\s+/)
);

const MAX_TERMS = 10;

/**
 * The search query for a question: its topic words, in order, topped up
 * with the cited articles' keywords when the question alone says little
 * ("What did they find?").
 */
export function relatedWorkQuery(question: string, keywords: string[] = []): string {
  const terms: string[] = [];
  const add = (t: string) => {
    const k = t.toLowerCase();
    if (!terms.some((x) => x.toLowerCase() === k)) terms.push(t);
  };
  for (const raw of question.normalize("NFKC").split(/[^\p{L}\p{N}'-]+/u)) {
    const w = raw.replace(/^['-]+|['-]+$/g, "");
    if (w.length < 3 || /^\d+$/.test(w) || STOPWORDS.has(w.toLowerCase())) continue;
    add(w);
    if (terms.length >= MAX_TERMS) break;
  }
  if (terms.length < 3) {
    for (const k of keywords) {
      const kw = k.replace(/\s+/g, " ").trim();
      if (kw.length >= 3 && kw.length <= 60) add(kw);
      if (terms.length >= 5) break;
    }
  }
  return terms.join(" ").slice(0, 200);
}

/** Roughly the same word: equal, or the same first five letters ("motivation" ~ "motivated"). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5);
}

function words(s: string): string[] {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);
}

/** How many of the query's words a title contains. */
export function titleMatches(title: string, query: string): number {
  const t = words(title);
  return [...new Set(words(query))].filter((q) => t.some((w) => sameWord(w, q))).length;
}

/**
 * Drops the journal's own articles (by DOI), puts the titles that share
 * most words with the query first (sources otherwise come grouped by
 * index), drops titles sharing none when enough others do, and caps the list.
 */
export function outsideJournal(results: DiscoveryResult[], journalDois: Iterable<string>, limit = 12, query = ""): DiscoveryResult[] {
  const own = new Set([...journalDois].map((d) => d.toLowerCase()));
  const kept = results.filter((r) => !(r.doi && own.has(r.doi.toLowerCase())));
  if (!query) return kept.slice(0, limit);
  const scored = kept.map((r, i) => ({ r, i, score: titleMatches(r.title, query) }));
  const relevant = scored.filter((x) => x.score > 0);
  const pool = relevant.length >= 3 ? relevant : scored;
  return pool
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.r);
}
