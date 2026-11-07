import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { tenantHasUserCapacity } from "@/lib/tenant-quota";
import { generateReferralCode } from "@/lib/referrals";
import { generateTemporaryPassword } from "@/lib/tenant-onboarding";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { emailBrandOf, brandName } from "@/lib/email-brand";
import { APP_BASE_URL } from "@/lib/site";

/** Roles a tenant admin may give the people they add (never platform-level ones). */
const MEMBER_ROLES = ["READER", "AUTHOR", "REVIEWER", "ASSOCIATE_EDITOR", "EDITOR"] as const;

const Schema = z.object({
  fullName: z.string().trim().min(2, "Enter the person's full name").max(200),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address"),
  role: z.enum(MEMBER_ROLES),
  affiliation: z.string().trim().max(200).optional(),
});

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * POST /api/admin/tenant-members { fullName, email, role }
 * A tenant admin (or the platform SUPER_ADMIN, for the tenant this request
 * belongs to) adds a person to the institution's platform: the account is
 * created inside the tenant with a temporary password, which is emailed in
 * the institution's branding and must be changed at first sign-in.
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, ["TENANT_ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseBody(req, Schema);
  if (!parsed.ok) return parsed.response;
  const { fullName, email, role } = parsed.data;

  const tenantId =
    auth.session.role === "TENANT_ADMIN"
      ? auth.session.tenantId
      : new URL(req.url).searchParams.get("tenantId") ?? auth.session.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant for this account" }, { status: 400 });
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const taken = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (taken) return NextResponse.json({ error: "email: An account with this email already exists" }, { status: 409 });
  if (!(await tenantHasUserCapacity(tenant.id))) {
    return NextResponse.json({ error: "Your plan's user limit has been reached — contact Eleventh Press to raise it" }, { status: 403 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await db.user.create({
    data: {
      email,
      fullName,
      role,
      passwordHash: hashPassword(temporaryPassword),
      affiliation: parsed.data.affiliation || tenant.siteName || tenant.name,
      tenantId: tenant.id,
      mustChangePassword: true,
      emailVerifiedAt: new Date(),
      referralCode: generateReferralCode(),
    },
    select: { id: true, email: true, fullName: true, role: true, createdAt: true },
  });

  const brand = emailBrandOf(tenant);
  const org = brandName(brand);
  const loginUrl = `${APP_BASE_URL}/?view=login`;
  const roleLabel = role.replace(/_/g, " ").toLowerCase();
  const result = await sendEmail({
    to: email,
    subject: `You've been added to ${org}`,
    html: notificationEmailHtml({
      title: `Welcome to ${esc(org)}`,
      message: `Hi ${esc(fullName)}, you've been added to <strong>${esc(org)}</strong> as ${/^[aeiou]/.test(roleLabel) ? "an" : "a"} ${roleLabel}.<br/><br/>
        <strong>Sign in at:</strong> <a href="${loginUrl}">${loginUrl}</a><br/>
        <strong>Email:</strong> ${esc(email)}<br/>
        <strong>Temporary password:</strong> <code style="font-size:15px;background:#f4f2f7;padding:2px 6px;border-radius:4px;">${esc(temporaryPassword)}</code><br/><br/>
        You'll choose your own password when you first sign in.`,
      ctaUrl: loginUrl,
      ctaLabel: "Sign in",
      brand,
    }),
    text: `You've been added to ${org} as ${roleLabel}.\nSign in at: ${loginUrl}\nEmail: ${email}\nTemporary password: ${temporaryPassword}\nYou'll choose your own password when you first sign in.`,
  });

  await db.auditLog
    .create({
      data: {
        userId: auth.session.userId,
        action: "TENANT_MEMBER_ADDED",
        entityType: "USER",
        entityId: user.id,
        metadata: JSON.stringify({ tenantId: tenant.id, role, emailDelivered: result.ok && result.mode === "live" }),
      },
    })
    .catch(() => {});

  return NextResponse.json(
    {
      user,
      temporaryPassword,
      loginUrl,
      emailDelivered: result.ok && result.mode === "live",
    },
    { status: 201 }
  );
}
