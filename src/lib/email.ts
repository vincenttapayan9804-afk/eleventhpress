import { Resend } from "resend";

/**
 * Transactional email via Resend — the LiveMode-gated-external-service
 * pattern this repo already uses for Zenodo/VirusTotal/Meilisearch/etc.
 * Every call site that fires an email goes through here so the
 * live-vs-simulation fallback lives in exactly one place.
 *
 * Fails open: a missing key or a rejected send must never throw — it would
 * take down the business operation that triggered it (a payment
 * confirming, a decision publishing) along with it. Matches
 * src/lib/orcid-works.ts's "fails open, never blocks publish" convention.
 * sendEmail() always resolves; check `ok`/`mode` if the caller cares.
 */
export function emailLiveMode(): boolean {
  return !!process.env.RESEND_API_KEY;
}

let client: Resend | null = null;
function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY!);
  return client;
}

// Resend's own test sender — deliverable without a verified domain, same
// role Zenodo's sandbox host or iThenticate's simulation mode play
// elsewhere in this codebase: a real default that works out of the box
// while EMAIL_FROM (a verified sending domain) isn't configured yet.
const FALLBACK_FROM = "Eleventh Press <onboarding@resend.dev>";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  mode: "live" | "simulation";
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!emailLiveMode()) {
    console.warn(
      `[email] simulation mode — set RESEND_API_KEY to actually deliver "${params.subject}" to ${params.to}`
    );
    return { ok: true, mode: "simulation" };
  }
  try {
    const { error } = await getClient().emails.send({
      from: process.env.EMAIL_FROM || FALLBACK_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      console.error(`[email] Resend rejected "${params.subject}" to ${params.to}: ${error.message}`);
      return { ok: false, mode: "live", error: error.message };
    }
    return { ok: true, mode: "live" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] send failed for "${params.subject}" to ${params.to}: ${message}`);
    return { ok: false, mode: "live", error: message };
  }
}

/** Shared inline-styled template so every notification email looks the same without each call site rebuilding markup. */
/** Whitelabel overrides for the email template (see src/lib/email-brand.ts). */
export interface EmailBrand {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  contactLines: string[];
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function notificationEmailHtml(params: {
  title: string;
  message: string;
  ctaUrl?: string;
  ctaLabel?: string;
  brand?: EmailBrand;
}): string {
  const brand = params.brand;
  const name = escapeAttr(brand?.name ?? "Eleventh Press");
  // Only plain hex colours are used in email (some clients ignore oklch()).
  const color = brand?.primaryColor && /^#[0-9a-f]{3,8}$/i.test(brand.primaryColor) ? brand.primaryColor : "#42126b";
  const cta =
    params.ctaUrl && params.ctaLabel
      ? `<tr><td style="padding-top:24px;">
           <a href="${params.ctaUrl}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-family:sans-serif;font-size:14px;">${params.ctaLabel}</a>
         </td></tr>`
      : "";
  const header = brand?.logoUrl
    ? `<tr><td style="padding-bottom:4px;"><img src="${escapeAttr(brand.logoUrl)}" alt="${name}" height="40" style="height:40px;max-width:200px;object-fit:contain;display:block;" /></td></tr>
            <tr><td style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${color};">${name}</td></tr>`
    : `<tr><td style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${brand ? color : "#8a7aa0"};">${name}</td></tr>`;
  const contact = brand?.contactLines.length
    ? `<tr><td style="padding-top:12px;font-size:11px;line-height:1.5;color:#9a94a6;">${brand.contactLines.map(escapeAttr).join("<br/>")}</td></tr>`
    : "";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f2f7;font-family:sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;${brand ? `border-top:4px solid ${color};` : ""}">
            ${header}
            <tr><td style="padding-top:8px;font-size:18px;font-weight:600;color:#1a1a1a;">${params.title}</td></tr>
            <tr><td style="padding-top:12px;font-size:14px;line-height:1.6;color:#44404c;">${params.message}</td></tr>
            ${cta}
            <tr><td style="padding-top:28px;font-size:12px;color:#9a94a6;">You're receiving this because of activity on your ${name} account. Manage notification preferences from your dashboard.</td></tr>
            ${contact}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
