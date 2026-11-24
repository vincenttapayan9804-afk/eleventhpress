/**
 * The four footer policy pages, served at /policies/<slug>:
 * open access, double-blind peer review, Zenodo DOI deposit and
 * payment security (PCI-DSS).
 *
 * Rules for editing: describe only what the platform actually does.
 * Each claim here is backed by code — the CC BY 4.0 licence on every
 * Zenodo deposit (src/lib/zenodo.ts), the automatic deposit on
 * publication (src/app/api/articles/workflow/route.ts), the review models
 * (Article.reviewModel), and the hosted-checkout gateways with signed
 * webhooks (src/lib/payments/*).
 */
import { DOI_REGISTRAR } from "@/lib/site";

export type PolicyBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: { title: string; text: string }[] };

export interface PolicySection {
  heading: string;
  blocks: PolicyBlock[];
}

export interface PolicyPage {
  slug: string;
  /** Matches the footer link text. */
  title: string;
  eyebrow: string;
  summary: string;
  /** At-a-glance facts shown under the title. */
  highlights: { label: string; value: string }[];
  /** Overrides POLICY_PAGES_UPDATED for a page revised on its own date. */
  updated?: string;
  sections: PolicySection[];
  related: { label: string; href: string }[];
}

const p = (text: string): PolicyBlock => ({ kind: "p", text });
const list = (...items: string[]): PolicyBlock => ({ kind: "list", items });

export const POLICY_SLUGS = ["open-access", "peer-review", "doi-deposit", "payment-security", "editorial-standards"] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

export const POLICY_PAGES_UPDATED = "21 November 2026";

/** Builds every policy page for the visiting site's name. */
export function policyPages(name: string, editorialEmail: string): Record<PolicySlug, PolicyPage> {
  return {
    "open-access": {
      slug: "open-access",
      title: "Open access (CC BY 4.0)",
      eyebrow: "Publishing policy",
      summary: `Every article ${name} publishes is free to read, download and reuse from the day it is published, under the Creative Commons Attribution 4.0 International licence (CC BY 4.0). Authors keep their copyright.`,
      highlights: [
        { label: "Reader fee", value: "None, ever" },
        { label: "Licence", value: "CC BY 4.0" },
        { label: "Copyright", value: "Stays with the authors" },
        { label: "Embargo", value: "None" },
      ],
      sections: [
        {
          heading: "What open access means here",
          blocks: [
            p(`${name} is a Gold Open Access publisher. Every published article is freely readable online immediately on publication, with no subscription, login wall, pay-per-view charge or embargo period. Anyone, anywhere, can read, download, print and share the full text.`),
            p("Optional reader subscriptions exist only for convenience features such as bundled PDF downloads and saved reading lists. They never control access to the research itself."),
          ],
        },
        {
          heading: "The CC BY 4.0 licence",
          blocks: [
            p("Unless an individual article states otherwise, articles are published under the Creative Commons Attribution 4.0 International licence. Under this licence anyone may:"),
            list(
              "Share: copy and redistribute the article in any medium or format.",
              "Adapt: remix, transform, translate and build upon it.",
              "Use it for any purpose, including commercially.",
            ),
            p("The one condition is attribution: users must credit the original authors and source, link to the licence, and indicate if changes were made. The licence cannot be revoked once the article is published."),
          ],
        },
        {
          heading: "Copyright stays with the authors",
          blocks: [
            p(`Authors keep the copyright in their work. They grant ${name} a non-exclusive licence to publish it, and they release it to the public under CC BY 4.0. Authors may therefore reuse their own article freely, for example in a thesis, a book chapter, teaching materials or an institutional repository, without asking permission.`),
          ],
        },
        {
          heading: "Funder and institutional requirements",
          blocks: [
            p("CC BY 4.0 with immediate open access meets the licensing requirements of Plan S (cOAlition S) and most major funder and institutional open-access policies. Authors may deposit the published version in any repository at any time, with no embargo."),
          ],
        },
        {
          heading: "How open access is funded",
          blocks: [
            p("Because readers pay nothing, publishing costs (editorial handling, production, DOI registration and indexing) are covered by a one-time Article Processing Charge (APC). The APC is invoiced only after a manuscript is accepted, never at submission or during review."),
            p("Authors who cannot pay, including those from low- and middle-income settings or without funding, can request a full or partial waiver from their dashboard. Waiver requests are handled by the editorial office separately from peer review, and reviewers are never told whether a waiver was requested."),
          ],
        },
        {
          heading: "Making articles easy to find and reuse",
          blocks: [
            list(
              `Every published article receives a permanent ${DOI_REGISTRAR} DOI.`,
              "Article metadata is openly available through our OAI-PMH endpoint for harvesters such as OpenAIRE, BASE and CORE.",
              "Licence information is embedded in the article's machine-readable metadata (JATS XML and citation exports), so search engines and repositories can see that it is openly licensed.",
            ),
          ],
        },
        {
          heading: "Third-party material",
          blocks: [
            p("Figures, tables or other content reproduced from other sources may be under a different licence. Where this applies, the article's caption or credit line says so, and reusers must follow the original licence for that material."),
          ],
        },
      ],
      related: [
        { label: "CC BY 4.0 explained (guide)", href: "/resources/blog/open-access-licensing-cc-by-explained" },
        { label: "Creative Commons licence summary", href: "https://creativecommons.org/licenses/by/4.0/" },
        { label: "Zenodo DOI deposit", href: "/policies/doi-deposit" },
        { label: "Pricing and APC", href: "/pricing" },
      ],
    },

    "peer-review": {
      slug: "peer-review",
      title: "Double-blind peer review",
      eyebrow: "Editorial policy",
      summary: `${name} uses double-blind peer review by default: reviewers do not know who the authors are, and authors do not know who reviewed their work. This keeps the assessment focused on the research itself.`,
      highlights: [
        { label: "Default model", value: "Double-blind" },
        { label: "First decision", value: "Usually 8–12 weeks" },
        { label: "Reviewers", value: "Matched to the discipline" },
        { label: "Unreviewed papers", value: "Never published" },
      ],
      sections: [
        {
          heading: "What double-blind means",
          blocks: [
            p("In double-blind review, the identities of authors and reviewers are hidden from each other throughout the process. Reviewers see an anonymised manuscript, and their reports reach the authors without their names. Only the handling editor knows both sides."),
            p("Hiding identities reduces the risk that a paper is judged on who wrote it, where they work, their gender, their country or how well known they are, rather than on the quality of the work."),
          ],
        },
        {
          heading: "The review process, step by step",
          blocks: [
            {
              kind: "steps",
              items: [
                { title: "Submission", text: "The author submits the manuscript and its details through their dashboard, and can follow its progress there at every stage." },
                { title: "Editorial screening", text: "The editorial office checks scope, completeness and formatting, and runs an automated similarity check against our published corpus before any reviewer sees the paper." },
                { title: "Anonymisation", text: "The manuscript is reviewed without author names, affiliations or other identifying details." },
                { title: "Reviewer matching", text: "The editor invites reviewers with expertise in the manuscript's discipline. Reviewers must declare any conflict of interest and step aside if one exists." },
                { title: "Review", text: "Reviewers assess originality, methods, evidence, clarity and relevance, and recommend accept, minor revision, major revision or reject." },
                { title: "Decision", text: "The handling editor weighs the reports and makes the decision. Reviewers advise; the editor decides." },
                { title: "Revision", text: "Authors respond to each comment and resubmit. Revised manuscripts may go back to the same reviewers." },
                { title: "Acceptance and publication", text: "Accepted articles move into production, receive a DOI and are published open access." },
              ],
            },
          ],
        },
        {
          heading: "How authors should anonymise a manuscript",
          blocks: [
            list(
              "Remove author names, affiliations, acknowledgements and funding details from the main manuscript file. These are entered separately in the submission form.",
              "Refer to your own earlier work in the third person (for example, \"Santos (2024) showed…\" rather than \"In our previous study…\").",
              "Remove identifying information from file properties and document metadata.",
              "Avoid naming your institution in the methods section, for example in ethics approval statements. Use \"[blinded for review]\" and add the details after acceptance.",
            ),
          ],
        },
        {
          heading: "Other review models",
          blocks: [
            p("Double-blind is the default. Where the norms of a discipline call for it, a journal may use single-blind review (reviewers know the authors, but not the reverse) or open review (identities are known to both sides). The model used for each article is recorded and shown with the published article, so readers always know how it was reviewed."),
          ],
        },
        {
          heading: "Expectations of reviewers",
          blocks: [
            list(
              "Keep the manuscript and the review confidential, and do not use unpublished findings for their own work.",
              "Declare any competing interest and decline the invitation if one exists.",
              "Do not try to identify the authors.",
              "Give constructive, evidence-based and respectful feedback.",
              "Do not upload the manuscript to public AI tools or other outside services.",
            ),
          ],
        },
        {
          heading: "Fairness and integrity",
          blocks: [
            p("Our peer-review practice follows the guidance of the Committee on Publication Ethics (COPE). Decisions are never influenced by whether an author has paid, will pay, or has asked for a fee waiver. Authors who believe a decision was unfair may appeal to the editorial office, and the appeal is assessed by an editor who was not involved in the original decision."),
            p(`Questions about peer review can be sent to ${editorialEmail}.`),
          ],
        },
      ],
      related: [
        { label: "Double-blind review explained (guide)", href: "/resources/blog/double-blind-peer-review-plain-language-guide" },
        { label: "Appeal an editorial decision", href: "/resources/forms/appeal-of-an-editorial-decision" },
        { label: "All editorial policies", href: "/policies" },
        { label: "Publication Charter", href: "/charter" },
      ],
    },

    "doi-deposit": {
      slug: "doi-deposit",
      title: `${DOI_REGISTRAR} DOI deposit`,
      eyebrow: "Preservation and indexing",
      summary: `Every article ${name} publishes is deposited in Zenodo, the open research repository run by CERN, and receives a permanent Digital Object Identifier (DOI). The DOI always leads to the article, wherever it is hosted in future.`,
      highlights: [
        { label: "Repository", value: "Zenodo (CERN)" },
        { label: "DOI agency", value: "DataCite" },
        { label: "When", value: "Automatically at publication" },
        { label: "Cost to authors", value: "Included" },
      ],
      sections: [
        {
          heading: "What a DOI is and why it matters",
          blocks: [
            p("A DOI is a permanent identifier for a piece of research, written like 10.5281/zenodo.1234567. Unlike an ordinary web address, a DOI keeps working even if a website changes or moves, so citations to the article never break."),
            p("DOIs are also how citation databases, reference managers, funders and institutions recognise and track scholarly work."),
          ],
        },
        {
          heading: "Why we use Zenodo",
          blocks: [
            list(
              "Zenodo is a trusted, non-profit research repository operated by CERN and created with the European Commission's OpenAIRE project.",
              "Zenodo DOIs are registered through DataCite, one of the official DOI registration agencies.",
              "Zenodo keeps records for the lifetime of the repository, giving every article an independent preservation copy outside our own platform.",
              "Zenodo records are harvested automatically by OpenAIRE and appear in open discovery services such as BASE and CORE.",
            ),
          ],
        },
        {
          heading: "How the deposit works",
          blocks: [
            {
              kind: "steps",
              items: [
                { title: "Publication", text: "When the editor publishes an accepted article, the platform deposits it in Zenodo automatically. Authors do not need to do anything." },
                { title: "Metadata", text: "The deposit includes the title, abstract, authors with their affiliations and ORCID iDs, keywords, the CC BY 4.0 licence and open-access status." },
                { title: "DOI registration", text: "Zenodo registers the DOI with DataCite and the DOI is added to the article page and its citation exports." },
                { title: "Checks and retries", text: "If the deposit is ever interrupted, the editorial team can retry it from the dashboard so that no article is left without a DOI." },
              ],
            },
          ],
        },
        {
          heading: "What else receives a DOI",
          blocks: [
            list(
              "Datasets that authors link to their article can be deposited with their own DOI.",
              "Each version of a preprint can receive its own DOI, so every version can be cited.",
              "Where an article's review history is published, the compiled peer-review report can receive its own DOI.",
              "Correction and retraction notices are linked to the original article so the record stays complete.",
            ),
          ],
        },
        {
          heading: "Citing an article",
          blocks: [
            p("Always cite an article with its DOI as a full link, for example https://doi.org/10.5281/zenodo.1234567. Each article page also offers ready-made citations in common styles and formats for reference managers."),
          ],
        },
      ],
      related: [
        { label: "Preservation manifest", href: "/preservation-manifest" },
        { label: "About Zenodo", href: "https://about.zenodo.org/" },
        { label: "Open access (CC BY 4.0)", href: "/policies/open-access" },
      ],
    },

    "payment-security": {
      slug: "payment-security",
      title: "PCI-DSS across all payment gateways",
      eyebrow: "Payment security",
      summary: `Every payment to ${name} is handled by a payment gateway that is certified under the Payment Card Industry Data Security Standard (PCI-DSS). Your card details are entered on the gateway's own secure page and never reach our servers.`,
      highlights: [
        { label: "Card data on our servers", value: "Never stored" },
        { label: "Checkout", value: "Gateway-hosted pages" },
        { label: "Connection", value: "Encrypted (HTTPS)" },
        { label: "Gateways", value: "5 PCI-DSS certified" },
      ],
      sections: [
        {
          heading: "What PCI-DSS is",
          blocks: [
            p("PCI-DSS is the global security standard set by the major card brands (Visa, Mastercard, American Express, Discover and JCB) for any organisation that stores, processes or transmits card data. It covers encryption, network security, access control, monitoring and regular testing."),
          ],
        },
        {
          heading: "Our payment gateways",
          blocks: [
            p("You can pay an Article Processing Charge, subscription or other service with any of the following gateways. Each one is responsible for the PCI-DSS security of the card data it handles:"),
            list(
              "Stripe: cards and digital wallets.",
              "PayPal: PayPal balance and cards.",
              "PayMongo: cards and Philippine e-wallets.",
              "Xendit: cards, e-wallets and bank transfers in Southeast Asia.",
              "Lemon Squeezy: cards and PayPal, with sales tax handled for you.",
            ),
          ],
        },
        {
          heading: "How we keep your payment details safe",
          blocks: [
            {
              kind: "steps",
              items: [
                { title: "Hosted checkout", text: "When you choose to pay, you are sent to the gateway's own secure checkout page. You enter your card or wallet details there, not on our site." },
                { title: "No card data with us", text: "Card numbers, expiry dates and security codes are never sent to, processed by or stored on our servers. We only receive a confirmation that the payment succeeded, with a reference number and amount." },
                { title: "Verified confirmations", text: "Each payment confirmation from a gateway carries a digital signature that we check before marking an invoice as paid, so forged confirmations are rejected." },
                { title: "Encryption", text: "Every page on our site, and every connection to a gateway, uses HTTPS encryption." },
              ],
            },
          ],
        },
        {
          heading: "What we do store",
          blocks: [
            p("To issue receipts and keep accurate records, we store the invoice amount and currency, the gateway used, the gateway's transaction reference, the payment status and the date. This information is covered by our Privacy Policy, and you can request a copy or deletion of your data at any time."),
          ],
        },
        {
          heading: "Staying safe",
          blocks: [
            list(
              "We will never ask for your card number, security code or password by email, chat or phone.",
              "Before entering card details, check that the page belongs to the payment gateway and that the address starts with https://.",
              `If you receive a suspicious payment request that claims to be from ${name}, do not pay it. Forward it to ${editorialEmail}.`,
            ),
          ],
        },
        {
          heading: "Refunds and questions",
          blocks: [
            p(`Refunds are processed through the same gateway used for the original payment, and funds return to the same card or account. For billing questions, contact ${editorialEmail} with your invoice reference.`),
          ],
        },
      ],
      related: [
        { label: "Pricing", href: "/pricing" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Trust Center", href: "/trust" },
        { label: "PCI Security Standards Council", href: "https://www.pcisecuritystandards.org/" },
      ],
    },

    // Editorial standards for everything the site publishes: research
    // articles, magazine issues, and News & Notes. Written against the
    // Journalism Trust Initiative standard (CWA 17493, clauses 10–14).
    // Keep it truthful: the correction notice types match
    // CORRECTION_TYPE_LABELS (src/lib/article.ts), the AI label is
    // src/components/ai-label.tsx, and there are no public comments or
    // paid placements on the site today — say so if that changes.
    "editorial-standards": {
      slug: "editorial-standards",
      title: "Editorial standards",
      eyebrow: "Editorial policy",
      summary: `How ${name} keeps its work accurate and independent: how we correct mistakes, how we use AI, how we keep paid content apart from editorial work, the rules for reader contributions, and how to make a complaint. These standards apply to research articles, magazine issues and News & Notes alike.`,
      updated: "24 November 2026",
      highlights: [
        { label: "Corrections", value: "Visible and dated" },
        { label: "AI use", value: "Human-checked, disclosed" },
        { label: "Sponsored content", value: "Not published" },
        { label: "Complaints", value: "Answered in 10 working days" },
      ],
      sections: [
        {
          heading: "Our commitment",
          blocks: [
            p(`${name} publishes to inform readers accurately. We check facts before we publish, name our sources wherever we can, separate fact from opinion, and correct mistakes openly. Editorial decisions are made by our editors on the merits of the work, never because of who paid, who is asking, or who might be offended.`),
            p("Every piece is reviewed by a human editor before it is published. The editor in charge of a piece is accountable for it, whatever tools were used to make it."),
          ],
        },
        {
          heading: "Corrections: reporting a mistake",
          blocks: [
            p(`Anyone can tell us about a mistake. Use the contact form (choose "Research integrity concern" for a research article, or "General question" for anything else) or email ${editorialEmail}. Please include a link to the piece, what you believe is wrong, and any evidence.`),
            {
              kind: "steps",
              items: [
                { title: "We acknowledge it", text: "We confirm we have received your report within 3 working days." },
                { title: "We check it", text: "An editor who did not work on the piece checks the claim against the evidence and, where needed, asks the author or reporter." },
                { title: "We fix it", text: "A confirmed factual error in a news or magazine piece is corrected within 1 working day of being confirmed. Errors in research articles are handled with the authors and normally resolved within 10 working days; serious integrity cases can take longer, and we keep the person who reported it informed." },
                { title: "We tell you", text: "We reply to the person who reported the mistake with what we found and what we changed." },
              ],
            },
          ],
        },
        {
          heading: "Corrections: how fixes are marked",
          blocks: [
            p("We do not quietly change what we published. When a correction changes the meaning of a piece, readers can see what changed and when."),
            list(
              "News & Notes and magazine pieces: a dated \"Correction\" note is added at the end of the piece, saying what was wrong and what is now correct.",
              "Research articles: a formal notice is published and permanently linked to the article. It is one of four types: a Corrigendum (an error by the authors), an Erratum (an error we introduced in production), an Expression of Concern (a serious question still being investigated) or a Retraction.",
              "Retracted articles stay online, clearly marked as retracted with the reason, so that the record stays complete and earlier citations still lead somewhere.",
              "Spelling, grammar and formatting fixes that do not change the meaning can be made without a note.",
            ),
          ],
        },
        {
          heading: "How we use AI",
          blocks: [
            p("We use AI tools to help our editors work faster, never to replace their judgement. A named human editor is responsible for everything we publish."),
            p("AI tools may help us:"),
            list(
              "Search and map published research, and suggest sources for an editor to read and check.",
              "Draft summaries, translations and plain-language explanations of published articles.",
              "Check spelling, grammar, references and formatting.",
              "Transcribe recordings and suggest descriptions of images for accessibility.",
            ),
            p("AI tools are never used to:"),
            list(
              "Invent quotes, sources, data, statistics or references.",
              "Make realistic images, audio or video of real people or events and present them as real.",
              "Decide whether a manuscript is accepted, or replace a peer reviewer's assessment.",
              "Publish anything without a human editor reviewing it first.",
              "Process unpublished manuscripts in public AI tools that could keep or reuse them.",
            ),
            p("How we disclose it: text the platform generates automatically, such as an AI summary or translation, carries a visible \"AI-generated\" label. When AI helped produce a published piece in a significant way, for example by mapping the research behind it, the piece says so. Every fact is still checked by an editor against the original source."),
            p("Authors who submit to us must disclose their own use of AI in their submission, as set out in our policies for authors."),
          ],
        },
        {
          heading: "Keeping paid content separate",
          blocks: [
            p(`${name} does not currently publish advertising, sponsored articles or paid product placements. Our income comes from article processing charges, optional reader subscriptions and services, and none of these buys editorial coverage or a favourable decision.`),
            p("If we ever publish sponsored or paid content, these rules will apply:"),
            list(
              "It will be labelled \"Sponsored\" or \"Paid partnership\" at the top, in words, not only by colour or design, and the sponsor will be named.",
              "It will be kept visibly apart from editorial content and will never be presented as our own reporting or research.",
              "Editors and reporters will not write it, and sponsors will never see or approve editorial content before it is published.",
              "Whether a person or organisation pays us has no bearing on how we cover them.",
            ),
            p("Payment of an article processing charge never affects peer review. Reviewers are not told whether an author has paid or asked for a waiver."),
          ],
        },
        {
          heading: "Reader contributions",
          blocks: [
            p("We welcome contributions from readers and researchers. All of them are checked by an editor before anything is published."),
            list(
              "Research articles go through our peer-review process, with the same standards for everyone.",
              "Story ideas, tips and responses to something we published can be sent through the contact form. We read every message, but we cannot promise to publish or reply to all of them.",
              "When we publish a reader's response or letter, we may shorten it for length and clarity without changing its meaning, and we publish it under the contributor's real name unless there is a good reason, such as their safety, to withhold it.",
            ),
            p("We do not currently host public comments on the site. If we add them, comments will be moderated, and we will remove anything that is abusive, discriminatory, threatening, spam, an advertisement, a breach of someone's privacy, or unlawful. We will not remove a comment simply because it disagrees with us."),
          ],
        },
        {
          heading: "Making a complaint",
          blocks: [
            p(`If you believe something we published is inaccurate, unfair or breaks these standards, you can complain to us. Complaints are free and you do not need a lawyer. Use the contact form or email ${editorialEmail}, with a link to the piece and what you would like us to do.`),
            {
              kind: "steps",
              items: [
                { title: "Acknowledgement", text: "We confirm receipt within 3 working days and tell you who is handling your complaint." },
                { title: "Review", text: "An editor who was not involved in the piece looks into it and sends you a written answer within 10 working days. If it will take longer, we tell you why and when to expect an answer." },
                { title: "Second review", text: "If you are not satisfied with the answer, you can ask for it to be reviewed by the Editor-in-Chief, whose decision is final within our organisation." },
                { title: "Outcome", text: "If the complaint is upheld, we correct or update the piece as described above and tell you what we changed." },
              ],
            },
            p("Complaints about a peer-review decision follow our appeals process, which is assessed by an editor who was not involved in the original decision. Complaints are handled confidentially, and making one never affects how we treat your future submissions."),
            p("We are not yet a member of an independent press council or ombudsman scheme. If we join one, we will name it here, together with how to take a complaint to it."),
          ],
        },
      ],
      related: [
        { label: "Contact the editorial office", href: "/contact" },
        { label: "Appeal an editorial decision", href: "/resources/forms/appeal-of-an-editorial-decision" },
        { label: "Publication Charter", href: "/charter" },
        { label: "All editorial policies", href: "/policies" },
        { label: "Journalism Trust Initiative", href: "https://www.journalismtrustinitiative.org/" },
      ],
    },
  };
}

export function isPolicySlug(value: string): value is PolicySlug {
  return (POLICY_SLUGS as readonly string[]).includes(value);
}
