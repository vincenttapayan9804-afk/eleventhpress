/**
 * Shared target resolution + validation for the branding console's API
 * (/api/admin/tenant-branding and its /asset upload endpoint).
 */
import { z } from "zod";
import { db } from "./db";
import { requireTenantScope } from "./tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "./roles";
import { resolveTenantFromHeaders, FONT_FAMILY_OPTIONS, SOCIAL_LINK_KEYS } from "./tenant";
import type { SessionPayload } from "./auth";

type TenantRow = NonNullable<Awaited<ReturnType<typeof db.tenant.findUnique>>>;

export type BrandingTarget =
  | { ok: true; tenant: TenantRow; session: SessionPayload }
  | { ok: false; status: number; error: string };

/**
 * The tenant being branded: SUPER_ADMIN may name any tenant with
 * `?tenantId=` (the Tenants tab's "Branding" button); otherwise it's the
 * tenant this request belongs to — a tenant admin's own institution, or the
 * official site for the platform's SUPER_ADMIN. TENANT_ADMIN is always
 * confined to its own tenant by requireTenantScope.
 */
export async function resolveBrandingTarget(req: { url: string; headers: Headers }): Promise<BrandingTarget> {
  const requested = new URL(req.url).searchParams.get("tenantId");
  let tenantId = requested;
  if (!tenantId) {
    const current = await resolveTenantFromHeaders(req.headers);
    if (!current) return { ok: false, status: 404, error: "No tenant resolved for this request" };
    tenantId = current.id;
    // A super admin who opened a tenant's portal link (which is remembered
    // for the whole browser) still edits the official site from their own
    // Branding tab; a tenant is edited through ?tenantId= (Tenants tab).
    if (current.source === "portal") {
      const platform = await db.tenant.findFirst({ where: { isPlatform: true }, select: { id: true } });
      if (platform) tenantId = platform.id;
    }
  }
  const auth = requireTenantScope(req.headers, tenantId, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return auth;
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false, status: 404, error: "Tenant not found" };
  return { ok: true, tenant, session: auth.session };
}

// Deliberately restrictive — colour values are interpolated into a raw
// <style> block in the root layout, so they must never be able to contain
// "}" / "<" / ";" and break out of the declaration. Covers hex,
// rgb()/oklch()/hsl() functions, and CSS named colors.
const CSS_COLOR_RE = /^[a-zA-Z0-9#(),.%\s-]+$/;
const CssColor = z
  .string()
  .trim()
  .max(100)
  .regex(CSS_COLOR_RE, "Must be a plain CSS color (hex, rgb(), oklch(), etc.)");

/** Empty string -> null so "clear this field" works from a plain form. */
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** Absolute http(s) URL, or a same-site storage path (local-dev uploads). */
const AssetUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/api/storage/"), "Must be an http(s) URL");

/** Accepts "example.org" as well as full URLs; always stored with a scheme. */
const WebUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Must be a valid web address");

const Phone = z
  .string()
  .trim()
  .max(60)
  .regex(/^[0-9+()\-.\s/extEXT]+$/, "Use digits, spaces, + ( ) - . / and ext only");

const opt = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(blankToNull, schema.nullable()).optional();

export const BrandingSchema = z.object({
  siteName: opt(z.string().trim().max(200)),
  tagline: opt(z.string().trim().max(300)),
  logoUrl: opt(AssetUrl),
  faviconUrl: opt(AssetUrl),
  primaryColor: opt(CssColor),
  accentColor: opt(CssColor),
  fontFamily: opt(z.enum(FONT_FAMILY_OPTIONS)),
  officialEmail: opt(z.string().trim().toLowerCase().max(254).email("Enter a valid email address")),
  supportEmail: opt(z.string().trim().toLowerCase().max(254).email("Enter a valid email address")),
  phone: opt(Phone),
  phoneAlt: opt(Phone),
  websiteUrl: opt(WebUrl),
  address: opt(z.string().trim().max(500)),
  legalName: opt(z.string().trim().max(300)),
  legalJurisdiction: opt(z.string().trim().max(200).regex(/^[^<>{}]*$/, "Use plain text")),
  privacyEmail: opt(z.string().trim().toLowerCase().max(254).email("Enter a valid email address")),
  socialLinks: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (v == null) return v;
      const out: Record<string, string> = {};
      for (const key of SOCIAL_LINK_KEYS) {
        const raw = v[key];
        if (typeof raw !== "string" || !raw.trim()) continue;
        const parsed = WebUrl.safeParse(raw);
        if (!parsed.success) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key}: must be a valid web address`, path: [key] });
          return z.NEVER;
        }
        out[key] = parsed.data;
      }
      return Object.keys(out).length ? out : null;
    }),
});

export type BrandingInput = z.infer<typeof BrandingSchema>;

/** ISSN / e-ISSN: "1234-567X" (the hyphen is optional on input). */
const Issn = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => (/^\d{4}\d{3}[\dX]$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4)}` : v))
  .refine((v) => /^\d{4}-\d{3}[\dX]$/.test(v), "Use the format 1234-567X");

/**
 * Journal & publication details a whitelabel tenant controls. These are
 * what every generated document prints — galley mastheads, JATS/EPUB
 * metadata, citations, provenance and certificate reports — so a tenant
 * never has to ask the platform to change its own journal's identity.
 */
export const JournalDetailsSchema = z.object({
  name: z.preprocess(blankToNull, z.string().trim().min(2).max(300).nullable()).optional(),
  abbreviation: opt(z.string().trim().max(120)),
  publisher: opt(z.string().trim().max(300)),
  issn: opt(Issn),
  eissn: opt(Issn),
  description: opt(z.string().trim().max(4000)),
  aimsScope: opt(z.string().trim().max(8000)),
});

export const BrandingUpdateSchema = BrandingSchema.extend({ journal: JournalDetailsSchema.optional() });

type JournalRow = { name: string; abbreviation: string | null; publisher: string; issn: string | null; eissn: string | null; description: string | null; aimsScope: string | null };

/** The journal form as stored; the schema's platform default publisher reads as blank. */
export function journalFormOf(j: JournalRow | null) {
  if (!j) return null;
  const platformDefault = j.publisher.trim().toLowerCase() === "eleventh press international publishing";
  return {
    name: j.name,
    abbreviation: j.abbreviation,
    publisher: platformDefault ? null : j.publisher,
    issn: j.issn,
    eissn: j.eissn,
    description: j.description,
    aimsScope: j.aimsScope,
  };
}

/** What the console reads back: raw stored values (no defaults filled in). */
export function brandingFormOf(t: TenantRow) {
  return {
    siteName: t.siteName,
    tagline: t.tagline,
    logoUrl: t.logoUrl,
    faviconUrl: t.faviconUrl,
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    fontFamily: t.fontFamily,
    officialEmail: t.officialEmail,
    supportEmail: t.supportEmail,
    phone: t.phone,
    phoneAlt: t.phoneAlt,
    websiteUrl: t.websiteUrl,
    address: t.address,
    legalName: t.legalName,
    legalJurisdiction: t.legalJurisdiction,
    privacyEmail: t.privacyEmail,
    socialLinks: (t.socialLinks as Record<string, string> | null) ?? null,
  };
}
