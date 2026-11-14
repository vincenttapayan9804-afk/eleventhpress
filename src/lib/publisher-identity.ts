/**
 * Who a document or page is published by.
 *
 * Every generated document (galleys, EPUBs, book/magazine PDFs, provenance
 * and verification reports, invoices, catalogue exports) and every page
 * title needs the same answer: "whose name, ISSN, colours and contact
 * details go on this?". For a whitelabel tenant that is the tenant's own
 * institution — never Eleventh Press's name, and never Eleventh Press's
 * ISSN (2945-1138), which belongs to the platform journal only.
 *
 * Fallback order for a tenant: the journal's own fields → the tenant's
 * display name/branding → nothing (an empty ISSN is better than a wrong
 * one). The platform keeps its existing identity from JOURNAL_IDENTITY.
 *
 * Note: Journal.publisher defaults to "Eleventh Press International
 * Publishing" in the schema, so a tenant journal that was auto-provisioned
 * without an explicit publisher still carries the platform's name. That
 * default is treated as "unset" for tenant journals.
 */
import { db } from "./db";
import { APP_BASE_URL, JOURNAL_IDENTITY } from "./site";
import { getObject } from "./storage";

export const PLATFORM_PUBLISHER_NAME = JOURNAL_IDENTITY.name;
export const PLATFORM_SHORT_NAME = JOURNAL_IDENTITY.shortName;

export { POWERED_BY_CREDIT, POWERED_BY_URL, poweredByFor } from "./powered-by";

/** Default brand colours used across the platform's own documents. */
export const PLATFORM_PRIMARY_HEX = "#4c1d95";
export const PLATFORM_ACCENT_HEX = "#c9a55c";

export interface PublisherIdentity {
  /** True when this belongs to a whitelabel tenant rather than the platform. */
  whitelabel: boolean;
  /** Organisation printed as the publisher ("Ron Publishing"). */
  publisher: string;
  /** Short brand label for seals, passkeys, authenticator apps. */
  shortName: string;
  /** The journal title (falls back to the publisher). */
  journalName: string;
  /** The journal's ISSN, or null — a tenant never inherits the platform ISSN. */
  issn: string | null;
  /** Online ISSN (e-ISSN), when the tenant has set one. */
  eissn: string | null;
  /** ISO 4 abbreviated journal title, when set. */
  abbreviation: string | null;
  /** Contact email for the publisher, if one is configured. */
  email: string | null;
  /** Postal address / location line, if configured. */
  location: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  /** Brand colours as #hex (safe for PDFKit and inline CSS). */
  primaryHex: string;
  accentHex: string;
  /** Tenant id when whitelabel (null for the platform). */
  tenantId: string | null;
}

export interface TenantLike {
  id?: string;
  name: string;
  isPlatform: boolean;
  siteName?: string | null;
  officialEmail?: string | null;
  supportEmail?: string | null;
  address?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

export interface JournalLike {
  name?: string | null;
  publisher?: string | null;
  issn?: string | null;
  eissn?: string | null;
  abbreviation?: string | null;
  tenantId?: string | null;
}

/** The journal columns every identity lookup needs. */
export const JOURNAL_SELECT = { name: true, publisher: true, issn: true, eissn: true, abbreviation: true, tenantId: true } as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A tenant colour as #hex, or the fallback when unset/not hex (e.g. oklch()). */
export function hexOr(color: string | null | undefined, fallback: string): string {
  const c = (color ?? "").trim();
  if (!HEX.test(c)) return fallback;
  if (c.length === 4) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  return c.toLowerCase();
}

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t ? t : null;
}

function isPlatformDefaultPublisher(publisher: string | null): boolean {
  if (!publisher) return true;
  const p = publisher.trim().toLowerCase();
  return p === PLATFORM_PUBLISHER_NAME.toLowerCase() || p === PLATFORM_SHORT_NAME.toLowerCase();
}

export const PLATFORM_IDENTITY: PublisherIdentity = Object.freeze({
  whitelabel: false,
  publisher: PLATFORM_PUBLISHER_NAME,
  shortName: PLATFORM_SHORT_NAME,
  journalName: PLATFORM_PUBLISHER_NAME,
  issn: JOURNAL_IDENTITY.issn,
  eissn: null,
  abbreviation: "EPIP Int. J. Multidiscip. Res.",
  email: JOURNAL_IDENTITY.editorialEmail,
  location: JOURNAL_IDENTITY.location,
  websiteUrl: null,
  logoUrl: null,
  primaryHex: PLATFORM_PRIMARY_HEX,
  accentHex: PLATFORM_ACCENT_HEX,
  tenantId: null,
}) as PublisherIdentity;

/** Pure resolver: tenant (+ optional journal) → identity. */
export function publisherIdentityOf(
  tenant: TenantLike | null | undefined,
  journal?: JournalLike | null
): PublisherIdentity {
  if (!tenant || tenant.isPlatform) {
    const journalName = clean(journal?.name) ?? PLATFORM_PUBLISHER_NAME;
    return {
      ...PLATFORM_IDENTITY,
      publisher: clean(journal?.publisher) ?? PLATFORM_PUBLISHER_NAME,
      journalName,
      issn: clean(journal?.issn) ?? JOURNAL_IDENTITY.issn,
      // The platform's own uploaded logo (the one its site header shows), if any.
      logoUrl: clean(tenant?.logoUrl),
    };
  }
  const org = clean(tenant.siteName) ?? clean(tenant.name) ?? "Journal";
  const journalPublisher = clean(journal?.publisher);
  return {
    whitelabel: true,
    publisher: journalPublisher && !isPlatformDefaultPublisher(journalPublisher) ? journalPublisher : org,
    shortName: org,
    journalName: clean(journal?.name) ?? org,
    issn: clean(journal?.issn),
    eissn: clean(journal?.eissn),
    abbreviation: clean(journal?.abbreviation),
    email: clean(tenant.officialEmail) ?? clean(tenant.supportEmail),
    location: clean(tenant.address),
    websiteUrl: clean(tenant.websiteUrl),
    logoUrl: clean(tenant.logoUrl),
    primaryHex: hexOr(tenant.primaryColor, PLATFORM_PRIMARY_HEX),
    accentHex: hexOr(tenant.accentColor, PLATFORM_ACCENT_HEX),
    tenantId: tenant.id ?? null,
  };
}

let platformTenantCache: { at: number; tenant: TenantLike | null } | null = null;

/** The platform's own tenant row (its branding/logo), cached briefly. */
async function platformTenant(): Promise<TenantLike | null> {
  if (platformTenantCache && Date.now() - platformTenantCache.at < 5 * 60 * 1000) return platformTenantCache.tenant;
  let tenant: TenantLike | null = null;
  try {
    tenant = await db.tenant.findFirst({ where: { isPlatform: true } });
  } catch {
    tenant = null;
  }
  platformTenantCache = { at: Date.now(), tenant };
  return tenant;
}

async function findTenant(tenantId: string | null | undefined): Promise<TenantLike | null> {
  // No tenant → the platform, whose branding row carries its logo.
  if (!tenantId) return platformTenant();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } }).catch(() => null);
  return tenant ?? platformTenant();
}

/** Identity for a tenant id (null/unknown → platform). Uses the tenant's journal when present. */
export async function publisherIdentityForTenantId(tenantId: string | null | undefined): Promise<PublisherIdentity> {
  const tenant = await findTenant(tenantId);
  if (!tenant || tenant.isPlatform) return publisherIdentityOf(tenant, null);
  const journal = await db.journal
    .findFirst({ where: { tenantId: tenant.id }, select: JOURNAL_SELECT })
    .catch(() => null);
  return publisherIdentityOf(tenant, journal);
}

/** Identity for a journal row (its tenant decides whitelabel vs platform). */
export async function publisherIdentityForJournal(journal: JournalLike | null | undefined): Promise<PublisherIdentity> {
  const tenant = await findTenant(journal?.tenantId);
  return publisherIdentityOf(tenant, journal ?? null);
}

/** Identity for an article, via its journal's tenant. */
export async function publisherIdentityForArticle(articleId: string): Promise<PublisherIdentity> {
  const article = await db.article
    .findUnique({ where: { id: articleId }, select: { journal: { select: JOURNAL_SELECT } } })
    .catch(() => null);
  return publisherIdentityForJournal(article?.journal ?? null);
}

/**
 * Fetches a logo and converts it to PNG for PDFKit (which cannot embed SVG
 * or WebP). Returns null on any failure — a missing logo must never fail
 * document generation.
 */
export async function logoPngOf(logoUrl: string | null | undefined, size = 512): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    let bytes: Buffer | null = null;
    // Uploaded logos may be stored as a same-site storage link
    // ("/api/storage/download?key=brand-assets/…"): read the object directly.
    const local = logoUrl.match(/^\/api\/storage\/download\?(.*)$/);
    if (local) {
      const key = new URLSearchParams(local[1]).get("key");
      bytes = key ? await getObject(key) : null;
    } else {
      const url = /^https?:\/\//i.test(logoUrl) ? logoUrl : logoUrl.startsWith("/") ? `${APP_BASE_URL}${logoUrl}` : null;
      if (!url) return null;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      bytes = Buffer.from(await res.arrayBuffer());
    }
    if (!bytes?.length) return null;
    const sharp = (await import("sharp")).default;
    return await sharp(bytes).resize(size, size, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch (e) {
    console.error("[publisher-identity] logo fetch/convert failed", e);
    return null;
  }
}

/**
 * For reports and exports that loop over many journals/articles: loads the
 * whitelabel tenants once and returns a synchronous resolver, so each row
 * names its own publisher (and never inherits the platform's name/ISSN).
 */
export async function publisherIdentityResolver(): Promise<(journal: JournalLike | null | undefined) => PublisherIdentity> {
  const tenants: TenantLike[] = await db.tenant.findMany({ where: { isPlatform: false } }).catch(() => []);
  const byId = new Map<string, TenantLike>(tenants.map((t) => [t.id as string, t]));
  return (journal) => publisherIdentityOf(journal?.tenantId ? byId.get(journal.tenantId) ?? null : null, journal ?? null);
}
