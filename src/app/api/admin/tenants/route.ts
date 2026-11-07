import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { getOrCreateTenantJournal } from "@/lib/tenant";
import { getTenantEntitlements, syncTenantEntitlements } from "@/lib/tenant-entitlements";
import { TENANT_PLAN_KEYS } from "@/lib/tenant-plans";
import { hashPassword } from "@/lib/auth";
import { generateReferralCode } from "@/lib/referrals";
import {
  RESERVED_TENANT_SLUGS,
  slugify,
  uniqueTenantSlug,
  generateTemporaryPassword,
  sendTenantAdminCredentials,
  tenantLinks,
} from "@/lib/tenant-onboarding";

/**
 * GET/POST /api/admin/tenants
 * SUPER_ADMIN only — platform-level tenant management (Whitelabel Phase 3).
 * There is no tenant-scoped admin role yet (that's Phase 4), so tenant
 * creation/listing is platform-super-admin-only by design.
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const CreateTenantSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the institution's name").max(200),
    // Optional: generated from the name when omitted.
    slug: z.preprocess(
      blankToUndefined,
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2)
        .max(63)
        .regex(SLUG_RE, "Lowercase letters, numbers, and hyphens only; can't start or end with a hyphen")
        .refine((v) => !RESERVED_TENANT_SLUGS.has(v), "That address is reserved — choose another")
        .optional()
    ),
    // The institution's administrator. When given, their TENANT_ADMIN
    // account is created and the sign-in details are emailed to them.
    adminName: z.preprocess(blankToUndefined, z.string().trim().min(2).max(200).optional()),
    adminEmail: z.preprocess(blankToUndefined, z.string().trim().toLowerCase().max(254).email("Enter a valid email address").optional()),
    plan: z.preprocess(
      blankToUndefined,
      z.string().refine((v) => TENANT_PLAN_KEYS.includes(v), "Unknown plan").optional()
    ),
  })
  .refine((v) => !v.adminEmail || !!v.adminName, { message: "Enter the administrator's full name", path: ["adminName"] });

export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { domains: true, users: true } },
      domains: { orderBy: { createdAt: "asc" } },
      users: { where: { role: "TENANT_ADMIN", deletedAt: null }, select: { id: true, email: true, fullName: true, mustChangePassword: true } },
    },
  });

  // Commercial Layer Phase 0 — entitlements are cheap enough (at most
  // ALL_MODULE_KEYS.length rows per tenant, and most tenants have zero)
  // to fetch per-tenant here rather than adding a second round trip from
  // the admin UI for each row it expands.
  const entitlementsByTenant = await Promise.all(tenants.map((t) => getTenantEntitlements(t.id)));

  return NextResponse.json({
    tenants: tenants.map((t, i) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      isPlatform: t.isPlatform,
      maxUsers: t.maxUsers,
      plan: t.plan,
      pricePerYear: t.pricePerYear ? Number(t.pricePerYear) : null,
      billingOwnerId: t.billingOwnerId,
      entitlements: entitlementsByTenant[i],
      createdAt: t.createdAt,
      domainCount: t._count.domains,
      userCount: t._count.users,
      admins: t.users.map((u) => ({ id: u.id, email: u.email, fullName: u.fullName, pendingFirstSignIn: u.mustChangePassword })),
      siteName: t.siteName,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
      portalUrl: tenantLinks(t.slug).portalUrl,
      domains: t.domains.map((d) => ({
        id: d.id,
        hostname: d.hostname,
        isPrimary: d.isPrimary,
        verified: d.verified,
        vercelAdded: d.vercelAdded,
        verificationToken: d.verified ? null : d.verificationToken,
        createdAt: d.createdAt,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseBody(req, CreateTenantSchema);
  if (!parsed.ok) return parsed.response;
  const { name, adminName, adminEmail, plan } = parsed.data;

  let slug: string;
  if (parsed.data.slug) {
    const existing = await db.tenant.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return NextResponse.json({ error: `slug: "${parsed.data.slug}" is already in use` }, { status: 409 });
    }
    slug = parsed.data.slug;
  } else {
    slug = await uniqueTenantSlug(slugify(name));
  }

  if (adminEmail) {
    const taken = await db.user.findFirst({ where: { email: { equals: adminEmail, mode: "insensitive" } }, select: { id: true } });
    if (taken) {
      return NextResponse.json(
        { error: "adminEmail: An account with this email already exists — use a different address for the institution's administrator" },
        { status: 409 }
      );
    }
  }

  const temporaryPassword = adminEmail ? generateTemporaryPassword() : null;

  const { tenant, admin } = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { slug, name, status: "ACTIVE", siteName: name, ...(plan ? { plan } : {}) },
    });
    const admin =
      adminEmail && adminName && temporaryPassword
        ? await tx.user.create({
            data: {
              email: adminEmail,
              fullName: adminName,
              passwordHash: hashPassword(temporaryPassword),
              role: "TENANT_ADMIN",
              affiliation: name,
              tenantId: tenant.id,
              mustChangePassword: true,
              // The platform administrator vouched for this address by
              // creating the account; the emailed credentials prove it.
              emailVerifiedAt: new Date(),
              referralCode: generateReferralCode(),
            },
            select: { id: true, email: true, fullName: true },
          })
        : null;
    if (admin) await tx.tenant.update({ where: { id: tenant.id }, data: { billingOwnerId: admin.id } });
    return { tenant, admin };
  });

  // Whitelabel Phase 5 — every tenant needs its own Journal to submit
  // manuscripts into; see getOrCreateTenantJournal's doc comment.
  await getOrCreateTenantJournal(tenant);
  if (plan) await syncTenantEntitlements(tenant.id, plan);

  // Free subdomain under the configured root domain, if one is set — no DNS
  // challenge needed since we already control the whole zone.
  const rootDomain = process.env.TENANT_ROOT_DOMAIN;
  let subdomain: { hostname: string } | null = null;
  if (rootDomain) {
    const hostname = `${tenant.slug}.${rootDomain}`;
    const domain = await db.tenantDomain.create({
      data: { tenantId: tenant.id, hostname, isPrimary: true, verified: true, verifiedAt: new Date() },
    });
    subdomain = { hostname: domain.hostname };
  }

  const delivery =
    admin && temporaryPassword
      ? await sendTenantAdminCredentials({
          to: admin.email,
          adminName: admin.fullName,
          tenantName: name,
          tenantSlug: tenant.slug,
          temporaryPassword,
        })
      : null;

  await db.auditLog
    .create({
      data: {
        userId: auth.session.userId,
        action: "TENANT_CREATED",
        entityType: "TENANT",
        entityId: tenant.id,
        metadata: JSON.stringify({ slug: tenant.slug, name, adminEmail: admin?.email ?? null, plan: plan ?? null, emailDelivered: delivery?.delivered ?? null }),
      },
    })
    .catch(() => {});

  return NextResponse.json(
    {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, isPlatform: tenant.isPlatform },
      subdomain,
      ...tenantLinks(tenant.slug),
      // Shown once to the SUPER_ADMIN so the details can be handed over
      // even when email delivery isn't configured. Never stored in clear.
      admin: admin ? { id: admin.id, email: admin.email, fullName: admin.fullName, temporaryPassword } : null,
      emailDelivered: delivery?.delivered ?? false,
      emailMode: delivery?.mode ?? null,
    },
    { status: 201 }
  );
}
