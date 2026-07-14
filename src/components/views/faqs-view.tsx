"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Mail } from "lucide-react";
import { DOI_REGISTRAR } from "@/lib/site";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Eleventh Press International Publishing, and is it peer-reviewed?",
    a: "Eleventh Press International Publishing is a peer-reviewed, open-access multidisciplinary journal covering the natural sciences, engineering, social sciences, and humanities. Every article that reaches publication has passed through our editorial screening and peer-review workflow — we don't publish unreviewed manuscripts.",
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
    q: "How do I request a correction, retraction, or report a concern about a published article?",
    a: "Email the editorial office at editorial@eleventhpress.org with the article's DOI and a description of the issue. Depending on severity, the editorial team may issue a Corrigendum (author error), an Erratum (publisher error), an Expression of Concern (unresolved doubt pending investigation), or a Retraction — each following COPE/ICMJE guidelines and published as a linked notice attached to the original article.",
  },
];

export function FaqsView() {
  const { setView } = useApp();
  const t = useTranslations("faqs");
  const th = useTranslations("home");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Accordion type="single" collapsible className="mt-6">
        {FAQS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="font-display text-base font-semibold">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-foreground/85">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <p className="eyebrow">{t("stillHaveQuestions")}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">{t("contactHeadline")}</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <a href="mailto:editorial@eleventhpress.org">
              <Mail className="mr-2 h-4 w-4" /> {t("emailUs")}
            </a>
          </Button>
          <Button variant="outline" onClick={() => setView("about")}>
            {th("aboutJournal")}
          </Button>
        </div>
      </section>
    </div>
  );
}
