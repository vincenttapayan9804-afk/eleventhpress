/**
 * The Research Assistant's answer format: plain Markdown the reader can
 * watch being written, with inline [P3]/[A1] evidence markers, then a line
 * "FOLLOW-UPS:" and the suggested follow-up questions, one per line.
 *
 * It replaced a JSON reply ({"answer", "usedPassages", "grounded",
 * "suggestedQuestions"}), which couldn't be shown until it was complete and
 * which free models often malformed. Pure functions, so they can be tested
 * without a model.
 */

export const FOLLOW_UPS_MARKER = "FOLLOW-UPS:";

/** Opening the model is told to use when the records don't answer the question at all. */
export const NOT_COVERED_OPENING = "The journal's records don't cover this.";

const MARKER_LINE = /(^|\n)[ \t>*_#-]*FOLLOW[- ]?UPS:?[ \t*_]*(?=\n|$)/i;

/**
 * Repairs Markdown slips free models make that would show as raw symbols:
 * a heading wrapped in bold ("**### Supporting evidence**") becomes a heading.
 */
export function tidyAnswerMarkdown(md: string): string {
  return md.replace(/^[ \t]*(\*\*|__)[ \t]*(#{1,6})[ \t]+(.+?)[ \t]*\1[ \t]*$/gm, "$2 $3");
}

/** Splits a complete reply into the answer and its follow-up questions. */
export function splitAnswer(reply: string): { answer: string; followUps: string[] } {
  const m = MARKER_LINE.exec(reply);
  if (!m) return { answer: tidyAnswerMarkdown(reply.trim()), followUps: [] };
  const answer = tidyAnswerMarkdown(reply.slice(0, m.index).trim());
  const followUps = reply
    .slice(m.index + m[0].length)
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 0);
  return { answer, followUps };
}

/**
 * How much of a reply still being written can be shown: everything before
 * the follow-ups marker, minus a short tail that might be the start of it.
 */
export function visibleLength(partial: string): number {
  const m = MARKER_LINE.exec(partial);
  if (m) return m.index;
  const lastLine = partial.lastIndexOf("\n");
  const tail = partial.slice(lastLine + 1).replace(/^[ \t>*_#-]*/, "");
  // An incomplete last line that could still turn into "FOLLOW-UPS:" is held back.
  if (tail && FOLLOW_UPS_MARKER.startsWith(tail.toUpperCase().replace(/ /g, "-"))) return lastLine + 1;
  return partial.length;
}

/** Passage numbers the answer cites inline ([P3], [P2, P5]), in order of first use. */
export function usedPassagesFromMarkers(answer: string): number[] {
  const out: number[] = [];
  for (const group of answer.matchAll(/\[([^\]]{1,80})\]/g)) {
    for (const item of group[1].split(/[,;]/)) {
      const m = /^\s*P(?:ASSAGE)?\s*(\d{1,3})\s*$/i.exec(item);
      if (m) {
        const n = Number(m[1]);
        if (n > 0 && !out.includes(n)) out.push(n);
      }
    }
  }
  return out;
}

/** False when the model said the records don't answer the question. */
export function isGrounded(answer: string): boolean {
  const opening = answer.trim().replace(/[’‘]/g, "'").toLowerCase();
  return !opening.startsWith(NOT_COVERED_OPENING.toLowerCase().replace(/\.$/, ""));
}
