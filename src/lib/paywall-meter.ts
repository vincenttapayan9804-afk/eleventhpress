import { db } from "@/lib/db";

/**
 * Paywall metering for magazine/media content ONLY — never the scholarly
 * Article pipeline. Every Article is blanket CC BY 4.0 / Gold OA, paid
 * for upfront by the author's APC specifically so readers never pay for
 * it a second time; metering that content would both breach the license
 * readers are promised and double-charge for access the author already
 * bought. MagazinePiece is a genuinely separate content line (The
 * Athletic/Axios-style media, not APC-funded research) and is the one
 * this benchmarks against (NYT/WaPo/The Information soft-paywall model).
 */

export const FREE_PIECES_PER_MONTH = 4;

export const READER_KEY_COOKIE = "reader_key";

/** "YYYY-MM" in UTC — a reader's free count resets every calendar month. */
export function currentMeterPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export interface MeterCheck {
  allowed: boolean;
  remaining: number | null; // null = unlimited (subscribed reader)
}

/**
 * Checks whether `readerKey` may read `pieceId` for free this month, and
 * records the read (idempotent — rereading the same piece within the same
 * month never consumes a second slot) when it's allowed. A subscribed
 * reader (an ACTIVE Subscription row) always bypasses the meter entirely.
 */
export async function checkAndRecordMeterAccess(
  readerKey: string,
  pieceId: string,
  hasActiveSubscription: boolean
): Promise<MeterCheck> {
  if (hasActiveSubscription) {
    return { allowed: true, remaining: null };
  }

  const period = currentMeterPeriod();

  const existing = await db.magazineMeterEvent.findUnique({
    where: { readerKey_pieceId_period: { readerKey, pieceId, period } },
  });
  if (existing) {
    const countThisMonth = await db.magazineMeterEvent.count({ where: { readerKey, period } });
    return { allowed: true, remaining: Math.max(0, FREE_PIECES_PER_MONTH - countThisMonth) };
  }

  const countThisMonth = await db.magazineMeterEvent.count({ where: { readerKey, period } });
  if (countThisMonth >= FREE_PIECES_PER_MONTH) {
    return { allowed: false, remaining: 0 };
  }

  // Best-effort: a logging failure must never turn into a reader wrongly
  // denied access, so this never throws into the caller.
  await db.magazineMeterEvent
    .create({ data: { readerKey, pieceId, period } })
    .catch(() => {});

  return { allowed: true, remaining: FREE_PIECES_PER_MONTH - countThisMonth - 1 };
}

/** True for any signed-in reader with a currently-ACTIVE Subscription row. */
export async function hasActiveSubscription(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const sub = await db.subscription.findFirst({ where: { userId, status: "ACTIVE" } });
  return !!sub;
}

/** Truncates bodyHtml to a teaser for a metered-out piece — strips tags
 * (a mid-element cut would otherwise render broken, unclosed markup) and
 * caps the plain text, matching the soft-paywall "read the first bit,
 * subscribe for the rest" convention this benchmarks against. */
export function teaserHtml(bodyHtml: string, maxChars = 400): string {
  const text = bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const truncated = text.length > maxChars ? `${text.slice(0, maxChars).trim()}…` : text;
  return `<p>${truncated}</p>`;
}
