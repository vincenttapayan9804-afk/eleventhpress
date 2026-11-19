/**
 * Topics for the site-wide contact form (ContactDialog, /contact and
 * POST /api/contact). Every call-to-action that used to open the visitor's
 * mail app (`mailto:`) now opens this form instead: a `mailto:` link does
 * nothing on a computer without a desktop mail program set up, which is
 * most browser-only users.
 *
 * Shared by client and server, so keep it free of server-only imports.
 */

export type ContactTopicKey =
  | "general"
  | "editorial"
  | "security"
  | "accessibility"
  | "integrity"
  | "privacy"
  | "terms"
  | "council"
  | "permissions"
  | "billing"
  | "technical"
  | "media";

export interface ContactTopic {
  key: ContactTopicKey;
  /** Shown in the topic picker. */
  label: string;
  /** Dialog heading when opened for this topic. */
  title: string;
  /** One line under the heading: what happens next. */
  intro: string;
  /** Placeholder for the message box. */
  placeholder: string;
  /** Promised first response, quoted in the acknowledgement email. */
  responseTime: string;
  /** Show the optional "related link" field (article, page or proof-of-concept URL). */
  wantsLink?: boolean;
  /** Label for the related link field. */
  linkLabel?: string;
  /** Sent to the privacy inbox rather than the editorial one. */
  privacyInbox?: boolean;
  /** Extra choice the sender must make (e.g. which data right). */
  options?: { label: string; choices: string[] };
}

export const CONTACT_TOPICS: ContactTopic[] = [
  {
    key: "general",
    label: "General question",
    title: "Contact us",
    intro: "Your message goes straight to the editorial office. We reply by email.",
    placeholder: "How can we help?",
    responseTime: "within 3 working days",
  },
  {
    key: "editorial",
    label: "Submissions & editorial",
    title: "Ask the editorial office",
    intro: "Questions about submitting, peer review, a manuscript in progress or the handling editor.",
    placeholder: "Include the manuscript ID if you have one.",
    responseTime: "within 3 working days",
    wantsLink: true,
    linkLabel: "Manuscript or article link (optional)",
  },
  {
    key: "security",
    label: "Report a vulnerability",
    title: "Report a security vulnerability",
    intro: "Reports go privately to the security contact. Please don't test against other people's accounts or data. We acknowledge within 3 working days.",
    placeholder: "What you found, where, how to reproduce it, and the impact you expect.",
    responseTime: "within 3 working days",
    wantsLink: true,
    linkLabel: "Affected page or endpoint (optional)",
    options: { label: "Severity (your estimate)", choices: ["Low", "Medium", "High", "Critical", "Not sure"] },
  },
  {
    key: "accessibility",
    label: "Accessibility issue",
    title: "Report an accessibility barrier",
    intro: "Tell us what got in your way. We can also send any article in an accessible format on request.",
    placeholder: "What were you trying to do, and what happened? Mention your browser and any assistive technology if you can.",
    responseTime: "within 5 working days",
    wantsLink: true,
    linkLabel: "Page where it happened (optional)",
  },
  {
    key: "integrity",
    label: "Research integrity concern",
    title: "Raise a research integrity concern",
    intro: "Concerns are handled confidentially under COPE guidance. You may raise one about any published article or a manuscript you reviewed.",
    placeholder: "Describe the concern and the evidence (e.g. duplicated figures, undisclosed conflicts, plagiarism).",
    responseTime: "within 5 working days",
    wantsLink: true,
    linkLabel: "Article link or DOI",
  },
  {
    key: "privacy",
    label: "Privacy & data rights",
    title: "Make a data rights request",
    intro: "Requests go to the data protection contact. We may ask you to confirm your identity before acting, and answer within 30 days.",
    placeholder: "Tell us what you'd like us to do with your personal data.",
    responseTime: "within 30 days, as data protection law requires",
    privacyInbox: true,
    options: {
      label: "Request type",
      choices: ["Access a copy of my data", "Correct my data", "Delete my data", "Object to or restrict processing", "Data portability", "Withdraw consent", "Other privacy question"],
    },
  },
  {
    key: "terms",
    label: "Terms of Service question",
    title: "Ask about the Terms of Service",
    intro: "Questions about licences, acceptable use or your account under the Terms.",
    placeholder: "Your question about the Terms.",
    responseTime: "within 5 working days",
  },
  {
    key: "council",
    label: "Council of Experts",
    title: "Contact the Council of Experts",
    intro: "Nominations, applications and questions about the Council of Experts.",
    placeholder: "Tell us about your inquiry, nomination or expertise.",
    responseTime: "within 5 working days",
    wantsLink: true,
    linkLabel: "ORCID or profile link (optional)",
  },
  {
    key: "permissions",
    label: "Permissions & reprints",
    title: "Request permissions or reprints",
    intro: "Most articles are CC BY 4.0 and can be reused with attribution. Ask here for anything else.",
    placeholder: "What would you like to reuse, and how?",
    responseTime: "within 5 working days",
    wantsLink: true,
    linkLabel: "Article link or DOI (optional)",
  },
  {
    key: "billing",
    label: "Billing & payments",
    title: "Billing and payments",
    intro: "Invoices, receipts, article processing charges, waivers and subscriptions.",
    placeholder: "Include the invoice or order number if you have one.",
    responseTime: "within 3 working days",
  },
  {
    key: "technical",
    label: "Technical problem",
    title: "Report a technical problem",
    intro: "Something not working? Tell us and we'll look into it.",
    placeholder: "What were you doing, and what went wrong? Copy any error message you saw.",
    responseTime: "within 3 working days",
    wantsLink: true,
    linkLabel: "Page where it happened (optional)",
  },
  {
    key: "media",
    label: "Press & partnerships",
    title: "Press and partnerships",
    intro: "Media inquiries, indexing services, institutional partnerships and collaborations.",
    placeholder: "Tell us about your organisation and what you have in mind.",
    responseTime: "within 5 working days",
  },
];

export const CONTACT_TOPIC_MAP: Record<ContactTopicKey, ContactTopic> = Object.fromEntries(
  CONTACT_TOPICS.map((t) => [t.key, t]),
) as Record<ContactTopicKey, ContactTopic>;

export function contactTopic(key: unknown): ContactTopic {
  return typeof key === "string" && key in CONTACT_TOPIC_MAP ? CONTACT_TOPIC_MAP[key as ContactTopicKey] : CONTACT_TOPIC_MAP.general;
}

function secureRandom(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/**
 * Short, human-quotable reference for an inquiry, e.g. "EP-SEC-261119-7K3Q".
 * Random, not sequential, so it reveals nothing about volume.
 */
export function contactReference(topic: ContactTopicKey, now = new Date(), rand: () => number = secureRandom): string {
  const code: Record<ContactTopicKey, string> = {
    general: "GEN", editorial: "EDI", security: "SEC", accessibility: "A11Y", integrity: "INT", privacy: "DPR",
    terms: "TOS", council: "COE", permissions: "PER", billing: "BIL", technical: "TEC", media: "PRS",
  };
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L
  let tail = "";
  for (let i = 0; i < 4; i++) tail += alphabet[Math.floor(rand() * alphabet.length)];
  return `EP-${code[topic]}-${ymd}-${tail}`;
}
