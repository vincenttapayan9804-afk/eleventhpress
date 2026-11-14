/**
 * The platform's trademark notice. The full brand name "Eleventh Press
 * International Publishing" is always followed by ™ wherever it is shown.
 * Values saved before the mark was adopted (tenant names, journal
 * publishers) are normalised at display time with `withTrademark`, and
 * comparisons use `stripTrademark` so both spellings match.
 */
export const TRADEMARK = "™";

const BRAND_RE = /Eleventh Press International Publishing(?!\s*(?:™|\(TM\)))/gi;

/** Appends ™ after every bare occurrence of the full brand name. */
export function withTrademark<T extends string | null | undefined>(s: T): T {
  if (!s) return s;
  return s.replace(BRAND_RE, (m) => m + TRADEMARK) as T;
}

/** Removes a trailing ™ / (TM) so names compare equal with or without it. */
export function stripTrademark(s: string): string {
  return s.replace(/\s*(?:™|\(TM\))/gi, "");
}
