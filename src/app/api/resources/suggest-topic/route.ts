import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { emailBrandForTenantId } from "@/lib/email-brand";
import { escapeHtml } from "@/lib/account-emails";
import { publisherIdentityForTenantId } from "@/lib/publisher-identity";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/ratelimit";
import { extractRequestIp } from "@/lib/institutions";

const KINDS = { trainings: "Training / course", webinars: "Webinar" } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Resources → Trainings & courses / Webinars → "Suggest a topic". Emails the
 * suggestion to the site's official editorial inbox (the tenant's own on a
 * whitelabel site), with Reply-To set to the sender, and sends the sender
 * a short acknowledgement. Works signed in or not; rate limited per IP.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  const rl = await checkRateLimit(`suggest-topic:${session?.userId ?? extractRequestIp(req.headers)}`, 5, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many suggestions. Please try again later." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (clean(body.website, 200)) return NextResponse.json({ ok: true }); // honeypot: bots fill hidden fields
  const kind = body.kind === "webinars" ? "webinars" : "trainings";
  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const topic = clean(body.topic, 160);
  const details = clean(body.details, 3000);
  if (!name || !topic) return NextResponse.json({ error: "Please give your name and a topic." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const tenantId = tenant && !tenant.isPlatform ? tenant.id : null;
  const identity = await publisherIdentityForTenantId(tenantId);
  const brand = await emailBrandForTenantId(tenantId);
  const inbox = identity.email || process.env.EMAIL_REPLY_TO || "editorial@eleventhpress.com";

  const label = KINDS[kind];
  const message = [
    `<strong>Type:</strong> ${label}`,
    `<strong>Topic:</strong> ${escapeHtml(topic)}`,
    `<strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;${session ? " (signed in)" : ""}`,
    details ? `<strong>Details:</strong><br/>${escapeHtml(details).replace(/\n/g, "<br/>")}` : "",
    `<span style="color:#8a8496">Reply to this email to answer ${escapeHtml(name)} directly.</span>`,
  ].filter(Boolean).join("<br/><br/>");
  const sent = await sendEmail({
    to: inbox,
    replyTo: email,
    subject: `${label} topic suggestion: ${topic}`,
    html: notificationEmailHtml({ title: `New ${label.toLowerCase()} topic suggestion`, message, brand }),
    text: `${label} topic suggestion\n\nTopic: ${topic}\nFrom: ${name} <${email}>\n\n${details}`,
  });
  if (!sent.ok) return NextResponse.json({ error: "We couldn't send your suggestion just now. Please try again shortly." }, { status: 502 });

  const title = "Thank you for your suggestion";
  await sendEmail({
    to: email,
    replyTo: brand?.replyTo,
    subject: title,
    html: notificationEmailHtml({
      title,
      message: `Hi ${escapeHtml(name.split(" ")[0])}, we've received your ${label.toLowerCase()} topic suggestion, “${escapeHtml(topic)}”. The editorial team reviews every suggestion when planning the programme.`,
      brand,
    }),
    text: `We've received your ${label.toLowerCase()} topic suggestion: ${topic}.`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
