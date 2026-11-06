/**
 * Clickable ready-made questions for the journal's RAG chat ("Ask the
 * Corpus"):
 *
 * - "Ask next": a few specific follow-ups the model writes for the paper
 *   the answer was about, cleaned here.
 * - "Explore this paper by section": one question per standard part of a
 *   research article (problem, background, research gap, research
 *   questions, hypotheses, framework, design, participants, instruments,
 *   analysis, results, discussion, conclusions, limitations,
 *   recommendations, significance, authorship), skipping parts the reader
 *   has already asked about.
 * - Starter questions about the newest papers before the first question.
 */

/** Specific follow-ups shown under an answer. */
export const MAX_SUGGESTIONS = 3;
const MIN_LENGTH = 12;
const MAX_LENGTH = 180;

export interface SectionQuestion {
  /** Short chip label, e.g. "Research gap". */
  section: string;
  /** The full question sent when the chip is clicked. */
  question: string;
}

interface SectionDef {
  section: string;
  question: (t: string) => string;
  /** Recognises a reader's question about this part of a paper. */
  asked: RegExp;
  /** Words papers typically use in this part, added to retrieval. */
  hints: string;
}

/** The parts of a research article, in reading order. */
const SECTIONS: SectionDef[] = [
  { section: "Problem", hints: "problem issue challenge concern", question: (t) => `What problem does ${t} address?`, asked: /\b(what|which) problems?\b|\baddress(es|ed)?\b|\bissues?\b/ },
  { section: "Background", hints: "background context introduction literature previous studies", question: (t) => `What is the background and context of ${t}?`, asked: /background|context|introduction|review of (related )?literature|literature review/ },
  { section: "Research gap", hints: "gap little known few studies lack limited research", question: (t) => `What research gap does ${t} aim to fill?`, asked: /\bgaps?\b|novel|contribution/ },
  {
    section: "Research questions", hints: "research questions objectives statement of the problem sought to answer purpose",
    question: (t) => `What are the statement of the problem and research questions of ${t}?`,
    asked: /research questions?|statement of the problem|problem statement|objectives?/,
  },
  { section: "Hypotheses", hints: "hypothesis hypotheses null significant relationship difference", question: (t) => `What hypotheses does ${t} test, and were they supported?`, asked: /hypothes/ },
  {
    section: "Theoretical framework", hints: "theory theoretical conceptual framework model",
    question: (t) => `What theoretical or conceptual framework underpins ${t}?`,
    asked: /framework|theor/,
  },
  {
    section: "Research design", hints: "design method methodology qualitative quantitative descriptive correlational phenomenological approach",
    question: (t) => `What research design and methods does ${t} use?`,
    asked: /\bdesign\b|\bmethods?\b|methodology|\bapproach\b/,
  },
  {
    section: "Respondents", hints: "respondents participants sample sampling population purposive random selected",
    question: (t) => `Who were the respondents or participants in ${t}, and how were they selected?`,
    asked: /respondent|participant|sample|population|subjects/,
  },
  {
    section: "Instruments", hints: "instrument questionnaire survey interview guide scale validated reliability tool",
    question: (t) => `What research instruments or tools did ${t} use to collect data?`,
    asked: /instrument|tool|questionnaire|survey|interview guide|scale|inventory/,
  },
  { section: "Data analysis", hints: "analysis statistical mean standard deviation thematic coding test", question: (t) => `How was the data analysed in ${t}?`, asked: /analy[sz]|statistic|thematic|coding/ },
  { section: "Results", hints: "results findings revealed showed significant", question: (t) => `What are the main results and findings of ${t}?`, asked: /results?|findings?|found|outcomes?/ },
  { section: "Discussion", hints: "discussion interpret consistent implies", question: (t) => `How do the authors interpret the results of ${t}?`, asked: /discussion|interpret|explain the results/ },
  { section: "Conclusions", hints: "conclusion concluded conclude", question: (t) => `What conclusions does ${t} draw?`, asked: /conclu/ },
  { section: "Limitations", hints: "limitations limited future research", question: (t) => `What limitations does ${t} acknowledge?`, asked: /limitation|weakness|shortcoming/ },
  { section: "Recommendations", hints: "recommendations recommended implications should", question: (t) => `What recommendations does ${t} make?`, asked: /recommend|implication|suggest/ },
  {
    section: "Significance", hints: "significance beneficial benefit contribute",
    question: (t) => `Why does ${t} matter, and who benefits from it?`,
    asked: /significance|importance|benefit|why (does|is) .* matter/,
  },
  {
    section: "Authors", hints: "",
    question: (t) => `Who wrote ${t}, and when was it published?`,
    asked: /who wrote|authors?\b|published|publication date|doi/,
  },
];

/** Converts an ALL-CAPS title to title case; leaves mixed-case titles alone. */
function normalizeCase(title: string): string {
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return title;
  const minor = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "via"]);
  return title
    .toLowerCase()
    .split(/(\s+)/)
    .map((w, i) => (i > 0 && minor.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

/**
 * A short, readable reference to a paper for use inside a question: the
 * part before a subtitle colon when that's descriptive enough, otherwise
 * the first eight words.
 */
export function shortTitle(title: string): string {
  const clean = normalizeCase(title.replace(/\s+/g, " ").trim());
  const beforeColon = clean.split(":")[0].trim();
  const base = beforeColon.split(" ").length >= 3 ? beforeColon : clean;
  const words = base.split(" ");
  const short = words.length > 8 ? `${words.slice(0, 8).join(" ")}…` : base;
  return short.replace(/[.,;:]+$/, "");
}

/**
 * Extra retrieval terms for a question about a part of a paper, so a
 * question like "Who were the respondents?" also matches passages that say
 * "participants", "sample" or "purposive sampling".
 */
export function sectionRetrievalHints(question: string): string {
  const lower = question.toLowerCase();
  return SECTIONS.filter((s) => s.hints && s.asked.test(lower))
    .map((s) => s.hints)
    .join(" ");
}

/** The section names, for the model prompt. */
export const SECTION_NAMES = SECTIONS.map((s) => s.section);

/** One question per section of a paper, in reading order. */
export function sectionQuestions(title: string): SectionQuestion[] {
  const t = `“${shortTitle(title)}”`;
  return SECTIONS.map((s) => ({ section: s.section, question: s.question(t) }));
}

/**
 * The section questions for `title`, minus the parts of the paper the
 * reader has already asked about, so the chips always point somewhere new.
 */
export function remainingSectionQuestions(title: string, alreadyAsked: string[]): SectionQuestion[] {
  const all = sectionQuestions(title);
  const templateKeys = new Map(all.map((sq, i) => [key(sq.question), i]));
  const covered = new Set<number>();
  for (const q of alreadyAsked) {
    const clicked = templateKeys.get(key(q));
    if (clicked !== undefined) {
      // A clicked chip covers exactly its own section.
      covered.add(clicked);
      continue;
    }
    // A typed question covers every section it mentions.
    const lower = q.toLowerCase();
    SECTIONS.forEach((s, i) => {
      if (s.asked.test(lower)) covered.add(i);
    });
  }
  return all.filter((_, i) => !covered.has(i));
}

function key(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Cleans the model's specific follow-ups: strings only, sensible length,
 * phrased as questions, no duplicates, nothing already asked, and nothing
 * that just repeats a section chip.
 */
export function finalizeSuggestions(
  modelSuggestions: unknown,
  alreadyAsked: string[],
  sectionChips: SectionQuestion[] = []
): string[] {
  const seen = new Set([...alreadyAsked, ...sectionChips.map((s) => s.question)].map(key));
  const out: string[] = [];
  if (!Array.isArray(modelSuggestions)) return out;
  for (const raw of modelSuggestions) {
    if (out.length >= MAX_SUGGESTIONS || typeof raw !== "string") continue;
    let q = raw.replace(/\s+/g, " ").trim().replace(/^[-*•\d.)\s]+/, "");
    if (q.length < MIN_LENGTH || q.length > MAX_LENGTH) continue;
    if (!q.endsWith("?")) q = `${q.replace(/[.!]+$/, "")}?`;
    const k = key(q);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}

/** Starter questions across the journal's most recent papers, one each. */
export function starterQuestions(titles: string[]): string[] {
  const variants = [
    (t: string) => `What problem does “${t}” address?`,
    (t: string) => `What are the main results and findings of “${t}”?`,
    (t: string) => `What research design and methods does “${t}” use?`,
    (t: string) => `Who were the respondents or participants in “${t}”?`,
  ];
  return titles.slice(0, 4).map((title, i) => variants[i % variants.length](shortTitle(title)));
}

export interface StarterPrompt {
  category: "Explore a paper" | "Compare studies" | "Synthesize the journal";
  question: string;
}

/**
 * Ready-made research prompts for the empty assistant: a question about
 * each of the newest papers, a comparison of the two newest, and
 * journal-wide synthesis questions.
 */
export function starterPrompts(titles: string[]): StarterPrompt[] {
  const out: StarterPrompt[] = starterQuestions(titles.slice(0, MAX_SUGGESTIONS)).map((question) => ({
    category: "Explore a paper",
    question,
  }));
  if (titles.length >= 2) {
    out.push({
      category: "Compare studies",
      question: `Compare the research designs, participants and findings of “${shortTitle(titles[0])}” and “${shortTitle(titles[1])}”.`,
    });
  }
  if (titles.length >= 3) {
    out.push({
      category: "Compare studies",
      question: `How do the research instruments used in “${shortTitle(titles[1])}” and “${shortTitle(titles[2])}” differ?`,
    });
  }
  if (titles.length > 0) {
    out.push(
      { category: "Synthesize the journal", question: "What research topics and methods are most common across the journal's recent articles?" },
      { category: "Synthesize the journal", question: "What research gaps and recommendations for future research do the journal's recent articles identify?" }
    );
  }
  return out;
}
