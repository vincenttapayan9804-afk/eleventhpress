import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { sendEmail, notificationEmailHtml, type EmailBrand, type SendEmailResult } from "@/lib/email";
import { emailBrandForTenantId, brandName } from "@/lib/email-brand";
import { APP_BASE_URL } from "@/lib/site";

/**
 * The account lifecycle emails: welcome, sign-in from a new device, and the
 * security notices (password changed, two-factor on/off, account locked,
 * account deleted). Every send is awaited by its caller — on Vercel a
 * response that returns first can freeze a pending send — and never throws
 * (sendEmail fails open), so an email problem can't fail the action itself.
 */

export interface AccountEmailUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const FORGOT_URL = () => `${APP_BASE_URL}/?view=login&forgot=1`;

async function send(
  user: AccountEmailUser,
  subject: (site: string) => string,
  body: (site: string) => { title: string; message: string; ctaUrl?: string; ctaLabel?: string; text?: string },
  brand?: EmailBrand
): Promise<SendEmailResult> {
  try {
    const b = brand ?? (await emailBrandForTenantId(user.tenantId));
    const site = brandName(b);
    const content = body(escapeHtml(site));
    return await sendEmail({
      to: user.email,
      subject: subject(site),
      html: notificationEmailHtml({ ...content, brand: b }),
      text: content.text,
    });
  } catch (err) {
    console.error("[account-emails]", err);
    return { ok: false, mode: "live", error: String(err) };
  }
}

/** Sent at sign-up: welcome plus the link that confirms the address. */
export function sendWelcomeEmail(user: AccountEmailUser, verificationToken: string, brand?: EmailBrand) {
  const verifyUrl = `${APP_BASE_URL}/api/auth/verify-email?token=${verificationToken}`;
  const name = escapeHtml(user.fullName);
  return send(
    user,
    (site) => `Welcome to ${site} — please confirm your email`,
    (site) => ({
      title: `Welcome to ${site}, ${name}`,
      message:
        `Your account is ready. Please confirm this is your email address so we can send you sign-in codes, ` +
        `password resets and updates on your submissions.<br/><br/>` +
        `From your dashboard you can submit a manuscript, track its review, and manage your profile and security settings.`,
      ctaUrl: verifyUrl,
      ctaLabel: "Confirm my email",
      text: `Welcome to ${site}, ${user.fullName}. Confirm your email: ${verifyUrl}`,
    }),
    brand
  );
}

export type SecurityEvent =
  | { kind: "password_changed"; via: "profile" | "reset" }
  | { kind: "two_factor_on"; method: "EMAIL" | "TOTP" }
  | { kind: "two_factor_off" }
  | { kind: "passkey_added"; name: string }
  | { kind: "account_locked"; minutes: number }
  | { kind: "account_deleted" }
  | { kind: "new_sign_in"; ip: string | null; userAgent: string | null };

const IF_NOT_YOU = (site: string) =>
  `If this wasn't you, reset your password straight away and contact the ${site} editorial office.`;

export function sendSecurityEmail(user: AccountEmailUser, event: SecurityEvent) {
  switch (event.kind) {
    case "password_changed":
      return send(
        user,
        (site) => `Your password was changed — ${site}`,
        (site) => ({
          title: "Your password was changed",
          message:
            `The password for your ${site} account was just changed${event.via === "reset" ? " using a reset link" : " from your profile"}. ` +
            `If this was you, there's nothing else to do. ${IF_NOT_YOU(site)}`,
          ctaUrl: FORGOT_URL(),
          ctaLabel: "Reset my password",
        })
      );
    case "two_factor_on":
      return send(
        user,
        (site) => `Two-factor sign-in is on — ${site}`,
        (site) => ({
          title: "Two-factor sign-in is on",
          message:
            `From now on, signing in to ${site} also needs ${event.method === "EMAIL" ? "a code we email to this address" : "a code from your authenticator app"}. ` +
            `Keep your backup codes somewhere safe. ${IF_NOT_YOU(site)}`,
        })
      );
    case "two_factor_off":
      return send(
        user,
        (site) => `Two-factor sign-in was turned off — ${site}`,
        (site) => ({
          title: "Two-factor sign-in was turned off",
          message: `Your ${site} account now signs in with just your password. ${IF_NOT_YOU(site)}`,
          ctaUrl: FORGOT_URL(),
          ctaLabel: "Reset my password",
        })
      );
    case "passkey_added":
      return send(
        user,
        (site) => `A passkey was added to your account — ${site}`,
        (site) => ({
          title: "A passkey was added",
          message: `A passkey named “${escapeHtml(event.name)}” can now sign in to your ${site} account. ${IF_NOT_YOU(site)}`,
          ctaUrl: FORGOT_URL(),
          ctaLabel: "Reset my password",
        })
      );
    case "account_locked":
      return send(
        user,
        (site) => `Sign-in paused after failed attempts — ${site}`,
        (site) => ({
          title: "Too many failed sign-in attempts",
          message:
            `Someone entered the wrong password for your ${site} account several times, so sign-in is paused for ${event.minutes} minute${event.minutes === 1 ? "" : "s"}. ` +
            `If it was you, wait and try again, or reset your password. If it wasn't, resetting your password keeps the account safe.`,
          ctaUrl: FORGOT_URL(),
          ctaLabel: "Reset my password",
        })
      );
    case "account_deleted":
      return send(
        user,
        (site) => `Your account was deleted — ${site}`,
        (site) => ({
          title: "Your account was deleted",
          message:
            `As requested, your ${site} account and personal details have been deleted. Published, citable work stays on the record without your personal details. ` +
            `If you didn't ask for this, contact the editorial office immediately.`,
        })
      );
    case "new_sign_in": {
      const when = new Date().toUTCString();
      const device = describeDevice(event.userAgent);
      return send(
        user,
        (site) => `New sign-in to your account — ${site}`,
        (site) => ({
          title: "New sign-in to your account",
          message:
            `Your ${site} account was just signed in to from a device we haven't seen before.<br/><br/>` +
            `<strong>When:</strong> ${escapeHtml(when)}<br/>` +
            `<strong>Device:</strong> ${escapeHtml(device)}<br/>` +
            (event.ip ? `<strong>IP address:</strong> ${escapeHtml(event.ip)}<br/>` : "") +
            `<br/>If this was you, there's nothing to do. ${IF_NOT_YOU(site)}`,
          ctaUrl: FORGOT_URL(),
          ctaLabel: "This wasn't me — reset password",
        })
      );
    }
  }
}

/** "Chrome on Windows" from a user-agent string; good enough for an alert. */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "A browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown system";
  return `${browser} on ${os}`;
}

// ── New-device sign-in alerts ────────────────────────────────────────────
// A long-lived cookie lists short HMAC tags of the accounts that have signed
// in on this browser. A sign-in whose tag isn't there gets an alert email.
export const KNOWN_DEVICE_COOKIE = "epip_known_device";
const MAX_TAGS = 8;

function deviceTag(userId: string): string {
  const key =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== "production" ? "epip-dev-only-insecure-secret-do-not-use-in-prod" : "");
  return crypto.createHmac("sha256", key).update(`known-device:${userId}`).digest("base64url").slice(0, 16);
}

export function readKnownTags(req: NextRequest): string[] {
  return (req.cookies.get(KNOWN_DEVICE_COOKIE)?.value || "").split(".").filter(Boolean);
}

/** Marks this browser as known for the account (no email). */
export function rememberDevice(req: NextRequest, res: NextResponse, userId: string): void {
  const tag = deviceTag(userId);
  const tags = [tag, ...readKnownTags(req).filter((t) => t !== tag)].slice(0, MAX_TAGS);
  res.cookies.set(KNOWN_DEVICE_COOKIE, tags.join("."), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

/**
 * Call on every completed sign-in. Emails a new-sign-in alert when this
 * browser hasn't signed in to the account before (skipped when the sign-in
 * itself already emailed a code), then remembers the browser.
 */
export async function noteSignIn(
  req: NextRequest,
  res: NextResponse,
  user: AccountEmailUser,
  ctx: { ip: string | null; userAgent: string | null; alreadyEmailed?: boolean }
): Promise<void> {
  const known = readKnownTags(req).includes(deviceTag(user.id));
  if (!known && !ctx.alreadyEmailed) {
    await sendSecurityEmail(user, { kind: "new_sign_in", ip: ctx.ip, userAgent: ctx.userAgent });
  }
  rememberDevice(req, res, user.id);
}
