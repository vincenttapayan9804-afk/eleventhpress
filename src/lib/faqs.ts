import { DOI_REGISTRAR } from "@/lib/site";
import type { LegalIdentity } from "@/lib/tenant-branding-context";

/**
 * The FAQ copy, kept out of the (client) FAQs view so the server can also
 * publish it as FAQPage structured data (src/app/[...slug]/page.tsx).
 */
export const PLATFORM_FAQS: { q: string; a: string }[] = [
  {
    q: "What is Eleventh Press International Publishing™, and is it peer-reviewed?",
    a: "Eleventh Press International Publishing™ is a Full-Stack Peer Reviewed Press & Multidisciplinary Syndication Network covering the natural sciences, engineering, social sciences, and humanities — not just a journal. Every article that reaches publication has passed through our editorial screening and peer-review workflow (we don't publish unreviewed manuscripts), and every published article becomes eligible for automatic syndication across our network and our book-publishing division.",
  },
  {
    q: "Is Eleventh Press open access? What license applies to published articles?",
    a: "Yes. Every published article is freely readable without a subscription, immediately on publication (Gold Open Access). Articles are published under a Creative Commons Attribution 4.0 (CC BY 4.0) license unless a specific article states otherwise, meaning anyone may share and adapt the work as long as appropriate credit is given.",
  },
  {
    q: "What is the Article Processing Charge (APC), and when is it due?",
    a: "The APC is a one-time fee of USD 97, charged to cover editorial handling, production, DOI registration, and indexing. It is invoiced only after your manuscript is accepted — never at submission or during peer review — and must be paid before the article enters production and is published.",
  },
  {
    q: "Are APC waivers available?",
    a: "Yes. Authors who are unable to pay the APC — including those from low- and middle-income institutions or without external funding — can request a full or partial waiver from their submission dashboard. Waiver requests are reviewed by the editorial office independently of the peer-review decision, and reviewers are never told whether a waiver has been requested.",
  },
  {
    q: "How much does a reader subscription cost, and what does it unlock?",
    a: "Reader subscriptions are USD 10/month, USD 97/year, or USD 997/year for institutional access. Since every article is open access, a subscription isn't required to read published research — it primarily unlocks convenience features such as bundled PDF downloads, saved reading lists, and early access to accepted-in-production articles ahead of final typesetting.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We support Stripe, PayPal, PayMongo, Xendit, and Lemon Squeezy, so you can pay by card, regional e-wallet, or bank transfer depending on which provider is most convenient in your country. Choose your preferred method at checkout for either an APC invoice or a subscription.",
  },
  {
    q: "How long does peer review take, and what review model do you use?",
    a: "We use double-blind peer review by default (author and reviewer identities are hidden from each other), with single-blind and open review available where disciplinary norms call for it. Most manuscripts receive an initial decision within 8–12 weeks of submission, though this varies by discipline and reviewer availability.",
  },
  {
    q: "How do I submit a manuscript?",
    a: "Create an author account, then use the \"Submit\" tab in your dashboard to upload your manuscript along with metadata (title, abstract, keywords, discipline, author list, and — where applicable — funder information and dataset links). You'll be able to track your submission through every stage of the review and production workflow from the same dashboard.",
  },
  {
    q: "Is my published article indexed anywhere (Google Scholar, DOI registries, etc.)?",
    a: `Every published article is assigned a real, permanently-resolving ${DOI_REGISTRAR} DOI and exposed through our OAI-PMH 2.0 endpoint, which harvesters (including OpenAIRE, BASE, and CORE) use to pull structured metadata. Google Scholar crawls the site automatically — journals cannot manually push content into a Scholar or Scopus index; those systems pull from the metadata a journal exposes once discovered.`,
  },
  {
    q: "What is the multidisciplinary syndication network, and do I have to do anything to use it?",
    a: "Once your article is published, it's automatically eligible for syndication across eight platforms: genuine one-click auto-publish to Blogger via the real Blogger API, ready-to-post share kits for ResearchGate, Academia.edu, Substack, Medium, LinkedIn Articles, and HubPages, and prefilled preprint submission packages for arXiv and SSRN. No extra manuscript prep — every package is generated from what you already submitted. The self-serve share kits are free; the arXiv/SSRN preprint packages are a one-time $19 add-on per article, since arXiv/SSRN preprinting has policy implications a preformatted package genuinely helps with.",
  },
  {
    q: "Do you publish books, not just journal articles?",
    a: "Yes. Authors can compile their own published articles into an edited volume or anthology, or submit a standalone monograph manuscript. We generate a real EPUB3 file and a print-ready PDF and distribute wide through Draft2Digital and IngramSpark — reaching Amazon KDP, Apple Books, Barnes & Noble, Kobo, and more storefronts from a single submission — for a one-time $29 distribution fee. Amazon KDP and Lulu are also available as free, self-serve manual guides if you'd rather publish directly yourself.",
  },
  {
    q: "How do I request a correction, retraction, or report a concern about a published article?",
    a: "Email the editorial office at editorial@eleventhpress.com with the article's DOI and a description of the issue. Depending on severity, the editorial team may issue a Corrigendum (author error), an Erratum (publisher error), an Expression of Concern (unresolved doubt pending investigation), or a Retraction — each following COPE/ICMJE guidelines and published as a linked notice attached to the original article.",
  },
];

/**
 * The FAQs as they read on this site: the official site's copy as written,
 * or — on a whitelabel tenant's site — the same answers in the tenant's own
 * name, with its own editorial contact, never Eleventh Press's.
 */
export function faqsFor(legal: LegalIdentity): { q: string; a: string }[] {
  if (!legal.whitelabel) return PLATFORM_FAQS;
  const org = legal.orgName;
  return PLATFORM_FAQS.map((item, i) => {
    if (i === 0) {
      return {
        q: `What is ${org}, and is it peer-reviewed?`,
        a: `${org} publishes peer-reviewed scholarship. Every article that reaches publication has passed through ${org}'s editorial screening and peer-review workflow (unreviewed manuscripts are not published), and every published article becomes eligible for automatic syndication and for the book-publishing services available on this platform.`,
      };
    }
    if (i === 1) return { ...item, q: `Is ${org} open access? What license applies to published articles?` };
    return {
      q: item.q.replace(/Eleventh Press International Publishing™?|Eleventh Press/g, org),
      a: item.a
        .replace(/editorial@eleventhpress\.com/g, legal.contactEmail)
        .replace(/Eleventh Press International Publishing™?|Eleventh Press/g, org),
    };
  });
}
