/**
 * One-step tenant onboarding: the platform SUPER_ADMIN names the
 * institution and its administrator; this creates the tenant, its journal
 * and the TENANT_ADMIN account with a temporary password, and emails the
 * sign-in details. The admin signs in on the official site, is asked to
 * choose a personal password (User.mustChangePassword) and set up 2FA,
 * then lands in the institution's own branded dashboard.
 */
import crypto from "crypto";
import { db } from "./db";
import { hashPassword } from "./auth";
import { APP_BASE_URL } from "./site";
import { sendEmail, notificationEmailHtml } from "./email";

/** Slugs that collide with routes or would read as official. */
export const RESERVED_TENANT_SLUGS = new Set(["exit", "www", "api", "admin", "app", "t", "eleventhpress", "platform", "official"]);

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .replace(/-+$/g, "") || "institution"
  );
}

/** `base`, or `base-2`, `base-3`… — the first that no tenant uses yet. */
export async function uniqueTenantSlug(base: string): Promise<string> {
  const root = RESERVED_TENANT_SLUGS.has(base) ? `${base}-institution` : base;
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const taken = await db.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${root}-${crypto.randomBytes(3).toString("hex")}`;
}

/**
 * A readable temporary password: three groups of unambiguous characters
 * (no 0/O, 1/l/I), ~71 bits of entropy. Shown once to the SUPER_ADMIN and
 * emailed to the new admin, who must replace it at first sign-in.
 */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const pick = (n: number) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join("");
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

export function tenantLinks(slug: string) {
  return {
    loginUrl: `${APP_BASE_URL}/?view=login`,
    portalUrl: `${APP_BASE_URL}/t/${slug}`,
  };
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Emails a tenant admin their sign-in details. Never throws; reports whether it was really delivered. */
export async function sendTenantAdminCredentials(params: {
  to: string;
  adminName: string;
  tenantName: string;
  tenantSlug: string;
  temporaryPassword: string;
  isReset?: boolean;
}): Promise<{ delivered: boolean; mode: "live" | "simulation" }> {
  const { loginUrl, portalUrl } = tenantLinks(params.tenantSlug);
  const title = params.isReset
    ? `New sign-in details for ${params.tenantName}`
    : `Your ${params.tenantName} research platform is ready`;
  const intro = params.isReset
    ? `Hi ${esc(params.adminName)}, a platform administrator issued you a new temporary password for <strong>${esc(params.tenantName)}</strong>.`
    : `Hi ${esc(params.adminName)}, your institution's research platform <strong>${esc(params.tenantName)}</strong> has been created on Eleventh Press, and you are its administrator.`;
  const message = `${intro}<br/><br/>
    <strong>Sign in at:</strong> <a href="${loginUrl}">${loginUrl}</a><br/>
    <strong>Email:</strong> ${esc(params.to)}<br/>
    <strong>Temporary password:</strong> <code style="font-size:15px;background:#f4f2f7;padding:2px 6px;border-radius:4px;">${esc(params.temporaryPassword)}</code><br/><br/>
    After signing in you'll choose your own password and set up two-factor authentication. Your dashboard then runs your whole research ecosystem: branding, journal and editorial workflow, reviewers, departments, ethics, grants, analytics and your team.<br/><br/>
    Your public portal: <a href="${portalUrl}">${portalUrl}</a>`;
  const text = `${title}

Sign in at: ${loginUrl}
Email: ${params.to}
Temporary password: ${params.temporaryPassword}

You'll choose your own password and set up two-factor authentication after signing in.
Public portal: ${portalUrl}`;

  const result = await sendEmail({
    to: params.to,
    subject: title,
    html: notificationEmailHtml({ title, message, ctaUrl: loginUrl, ctaLabel: "Sign in to your dashboard" }),
    text,
  });
  return { delivered: result.ok && result.mode === "live", mode: result.mode };
}

/** Issues a fresh temporary password for an existing account and flags it for change at next sign-in. */
export async function issueTemporaryPassword(userId: string): Promise<string> {
  const temporaryPassword = generateTemporaryPassword();
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: hashPassword(temporaryPassword),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  return temporaryPassword;
}
