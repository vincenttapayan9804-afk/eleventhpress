/**
 * Shared server-side pieces of the journal's AI Research Assistant ("Ask
 * the Corpus"): the journal masthead, conversation retention, and limits
 * on what a saved conversation may hold.
 */
import { db } from "@/lib/db";
import { JOURNAL_IDENTITY } from "@/lib/site";
import { publisherIdentityForTenantId } from "@/lib/publisher-identity";
import { withTrademark } from "@/lib/brand-mark";

export interface JournalInfo {
  name: string;
  issn: string | null;
  publisher: string;
  /** Set for a whitelabel tenant: its colours and online ISSN go on exported reports. */
  whitelabel?: boolean;
  eissn?: string | null;
  primaryHex?: string;
  accentHex?: string;
}

const JOURNAL_CACHE_MS = 5 * 60 * 1000;
const journalCache = new Map<string, { at: number; value: JournalInfo }>();

/** The journal's name, ISSN and publisher, from its record when there is
 * one, otherwise the platform's published identity. Cached briefly.
 *
 * With a whitelabel tenant's id, returns that tenant's own journal
 * identity (its name, its ISSN or none, and the tenant as publisher) —
 * never Eleventh Press's. */
export async function loadJournalInfo(tenantId?: string | null): Promise<JournalInfo> {
  const key = tenantId || "";
  const hit = journalCache.get(key);
  if (hit && Date.now() - hit.at < JOURNAL_CACHE_MS) return hit.value;
  let value: JournalInfo = { name: JOURNAL_IDENTITY.name, issn: JOURNAL_IDENTITY.issn, publisher: JOURNAL_IDENTITY.name };
  try {
    const identity = tenantId ? await publisherIdentityForTenantId(tenantId) : null;
    if (identity?.whitelabel) {
      value = {
        name: identity.journalName,
        issn: identity.issn,
        publisher: identity.publisher,
        whitelabel: true,
        eissn: identity.eissn,
        primaryHex: identity.primaryHex,
        accentHex: identity.accentHex,
      };
    } else {
      // The platform journal (no tenant); otherwise the journal the newest
      // published article belongs to — never an arbitrary tenant's journal.
      const select = { name: true, issn: true, publisher: true } as const;
      const row =
        (await db.journal.findFirst({ where: { tenantId: null }, select })) ??
        (await db.article.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: { journal: { select } } }))?.journal;
      if (row?.name) value = { name: row.name, issn: row.issn || JOURNAL_IDENTITY.issn, publisher: withTrademark(row.publisher) || JOURNAL_IDENTITY.name };
    }
  } catch {
    // Database unavailable: fall back to the platform identity.
  }
  journalCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * How long a saved conversation is kept after its last activity. Set by
 * RESEARCH_CHAT_RETENTION_DAYS (default 365). Conversations kept on a
 * reader's own device follow the same period.
 */
export function conversationRetentionDays(): number {
  const n = Number(process.env.RESEARCH_CHAT_RETENTION_DAYS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 365;
}

/** The retention period for conversations held on an institution's site:
 * its own setting (ResearchAssistantSettings.retentionDays) when it has one. */
export async function conversationRetentionDaysFor(tenantId: string | null): Promise<number> {
  const { getAssistantSettings } = await import("@/lib/research-assistant-settings");
  const own = (await getAssistantSettings(tenantId)).retentionDays;
  return own ?? conversationRetentionDays();
}

/** Feedback and issue reports are kept for this long (default 730 days). */
export function feedbackRetentionDays(): number {
  const n = Number(process.env.RESEARCH_FEEDBACK_RETENTION_DAYS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 730;
}

/** Deletes conversations inactive beyond the retention period, and old
 * feedback. Idempotent; run by scripts/purge-research-conversations.ts. */
export async function purgeExpiredResearchData(now = new Date()): Promise<{ conversations: number; feedback: number; queries: number }> {
  const day = 86_400_000;
  const defaultDays = conversationRetentionDays();
  const fbCutoff = new Date(now.getTime() - feedbackRetentionDays() * day);
  // Institutions with their own retention period first; everything else
  // follows the platform default.
  const custom = await db.researchAssistantSettings
    .findMany({ where: { retentionDays: { not: null } }, select: { tenantId: true, retentionDays: true } })
    .catch(() => [] as { tenantId: string; retentionDays: number | null }[]);
  let conversations = 0;
  for (const s of custom) {
    const r = await db.researchConversation.deleteMany({
      where: { tenantId: s.tenantId, updatedAt: { lt: new Date(now.getTime() - (s.retentionDays ?? defaultDays) * day) } },
    });
    conversations += r.count;
  }
  const rest = await db.researchConversation.deleteMany({
    where: {
      updatedAt: { lt: new Date(now.getTime() - defaultDays * day) },
      ...(custom.length ? { OR: [{ tenantId: null }, { tenantId: { notIn: custom.map((s) => s.tenantId) } }] } : {}),
    },
  });
  conversations += rest.count;
  const feedback = await db.researchFeedback.deleteMany({ where: { createdAt: { lt: fbCutoff } } });
  const { queryLogRetentionDays } = await import("@/lib/research-assistant-settings");
  const queries = await db.researchQueryLog
    .deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - queryLogRetentionDays() * day) } } })
    .then((r) => r.count)
    .catch(() => 0);
  return { conversations, feedback: feedback.count, queries };
}

export const LIMITS = {
  conversationsPerUser: 200,
  messagesPerConversation: 200,
  titleChars: 120,
  folderChars: 60,
  messageChars: 20_000,
  payloadChars: 60_000,
} as const;

/** A short conversation title from its first question. */
export function titleFromQuestion(question: string): string {
  const q = question.replace(/\s+/g, " ").trim();
  return q.length > 80 ? `${q.slice(0, 77).replace(/\s+\S*$/, "")}…` : q || "New conversation";
}

/** Validates a message payload (citations, sources, evidence, ...) as a
 * JSON string within the size limit, or returns null. */
export function serializePayload(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null;
  try {
    const s = JSON.stringify(payload);
    return s.length <= LIMITS.payloadChars ? s : null;
  } catch {
    return null;
  }
}

export function parsePayload(s: string | null): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
