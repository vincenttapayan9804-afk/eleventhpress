import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { emailBrandForTenantId } from "@/lib/email-brand";
import { escapeHtml } from "@/lib/account-emails";
import { publisherIdentityForTenantId } from "@/lib/publisher-identity";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/ratelimit";
import { extractRequestIp } from "@/lib/institutions";
import { contactReference, contactTopic, CONTACT_TOPIC_MAP } from "@/lib/contact-topics";
import { JOURNAL_IDENTITY } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Only http(s) links are passed on; anything else is dropped. */
function cleanUrl(v: unknown): string {
  const s = clean(v, 500);
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    // A DOI or manuscript ID rather than a URL: keep it as plain text.
    return s;
  }
}

/**
 * The site-wide contact form (ContactDialog and /contact). Emails the
 * message to the site's official inbox (the tenant's own on a whitelabel
 * site; the privacy contact for data-rights requests) with Reply-To set to
 * the sender, then sends the sender an acknowledgement quoting a reference
 * number. Works signed in or not; rate limited per user or IP; a hidden
 * honeypot field silently drops bot submissions.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  const rl = await checkRateLimit(`contact:${session?.userId ?? extractRequestIp(req.headers)}`, 6, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many messages from you in the last hour. Please try again later." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (clean(body.website, 200)) return NextResponse.json({ ok: true, reference: contactReference("general") });

  const topic = contactTopic(body.topic);
  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const subject = clean(body.subject, 160);
  const message = clean(body.message, 5000);
  const link = topic.wantsLink ? cleanUrl(body.link) : "";
  const option = topic.options && topic.options.choices.includes(clean(body.option, 120)) ? clean(body.option, 120) : "";
  const pageUrl = clean(body.pageUrl, 500);

  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (message.length < 10) return NextResponse.json({ error: "Please write a little more in your message (at least 10 characters)." }, { status: 400 });
  if (topic.options && !option) return NextResponse.json({ error: `Please choose: ${topic.options.label}.` }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Please confirm we may use your details to reply." }, { status: 400 });

  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const tenantId = tenant && !tenant.isPlatform ? tenant.id : null;
  const identity = await publisherIdentityForTenantId(tenantId);
  const brand = await emailBrandForTenantId(tenantId);
  const editorialInbox = identity.email || process.env.EMAIL_REPLY_TO || JOURNAL_IDENTITY.editorialEmail;
  const privacyInbox = (tenantId && tenant?.privacyEmail) || editorialInbox;
  const inbox = topic.privacyInbox ? privacyInbox : editorialInbox;

  const reference = contactReference(topic.key);
  const heading = subject || topic.label;
  const rows: [string, string][] = [
    ["Reference", reference],
    ["Topic", topic.label],
    ...(option ? [[topic.options!.label, option] as [string, string]] : []),
    ["From", `${name} <${email}>${session ? " (signed in)" : ""}`],
    ...(subject ? [["Subject", subject] as [string, string]] : []),
    ...(link ? [[topic.linkLabel?.replace(/\s*\(optional\)$/i, "") ?? "Link", link] as [string, string]] : []),
    ...(pageUrl ? [["Sent from page", pageUrl] as [string, string]] : []),
  ];
  const html = [
    ...rows.map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`),
    `<strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, "<br/>")}`,
    `<span style="color:#8a8496">Reply to this email to answer ${escapeHtml(name)} directly. Promised first response: ${escapeHtml(topic.responseTime)}.</span>`,
  ].join("<br/><br/>");

  const sent = await sendEmail({
    to: inbox,
    replyTo: email,
    subject: `[${reference}] ${topic.label}: ${heading}`,
    html: notificationEmailHtml({ title: `New message: ${topic.label}`, message: html, brand }),
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${message}`,
  });
  if (!sent.ok) {
    return NextResponse.json(
      { error: `We couldn't send your message just now. Please try again shortly, or email ${inbox} directly.` },
      { status: 502 },
    );
  }

  const ackTitle = "We've received your message";
  await sendEmail({
    to: email,
    replyTo: inbox,
    subject: `[${reference}] ${ackTitle}`,
    html: notificationEmailHtml({
      title: ackTitle,
      message: [
        `Hi ${escapeHtml(name.split(" ")[0])}, thank you for contacting us about <strong>${escapeHtml(topic.label.toLowerCase())}</strong>.`,
        `Your reference is <strong>${escapeHtml(reference)}</strong>. We aim to reply ${escapeHtml(topic.responseTime)}. To add anything, just reply to this email and keep the reference in the subject.`,
        `<span style="color:#8a8496">Your message:</span><br/>${escapeHtml(message).replace(/\n/g, "<br/>")}`,
      ].join("<br/><br/>"),
      brand,
    }),
    text: `Thank you for contacting us. Your reference is ${reference}. We aim to reply ${topic.responseTime}.\n\nYour message:\n${message}`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, reference, responseTime: topic.responseTime, topic: topic.key });
}

/** Topic list for clients that don't bundle contact-topics (and for docs). */
export function GET() {
  return NextResponse.json({ topics: Object.values(CONTACT_TOPIC_MAP).map(({ key, label }) => ({ key, label })) });
}
