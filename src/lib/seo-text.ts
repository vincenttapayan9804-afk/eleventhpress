/**
 * Search-snippet lengths. Bing Webmaster flags a <title> over 70 characters
 * and a meta description outside 25–160; Google truncates around the same
 * points. These helpers keep every page inside those limits without
 * changing the page's own headline or the social-card copy.
 */
export const MAX_TITLE = 70;
export const MAX_DESCRIPTION = 160;

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Cut at a word boundary and add an ellipsis, never exceeding `max`. */
export function clipText(text: string, max: number): string {
  const s = squash(text);
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.—–|(-]+$/, "")}…`;
}

/**
 * "<headline> | <brand>", trying each brand form in turn (full name, then a
 * shorter one) and dropping the brand only when even the headline alone
 * needs the room.
 */
export function searchTitle(headline: string, brands: Array<string | null | undefined> = [], sep = " | "): string {
  const main = squash(headline);
  for (const brand of brands) {
    const b = brand && squash(brand);
    if (b && main.length + sep.length + b.length <= MAX_TITLE) return `${main}${sep}${b}`;
  }
  return clipText(main, MAX_TITLE);
}

/** A meta description of at most 160 characters. */
export function searchDescription(text: string | null | undefined): string {
  return clipText(text || "", MAX_DESCRIPTION);
}
