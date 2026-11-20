"use client";

import { openContact } from "@/lib/contact-store";
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
import { useLegalIdentity } from "@/lib/tenant-branding-context";
import { faqsFor } from "@/lib/faqs";

export { faqsFor } from "@/lib/faqs";

export function FaqsView() {
  const { setView } = useApp();
  const legal = useLegalIdentity();
  const faqs = faqsFor(legal);
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
        {faqs.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="font-display text-base font-semibold">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-foreground/85 text-justify">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="mt-14 rounded-md border border-border bg-card p-8 text-center">
        <p className="eyebrow">{t("stillHaveQuestions")}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">{t("contactHeadline")}</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button onClick={() => openContact("general")} data-testid="cta-contact-faqs">
            <Mail className="mr-2 h-4 w-4" /> {t("emailUs")}
          </Button>
          <Button variant="outline" onClick={() => setView("about")}>
            {th("aboutJournal")}
          </Button>
        </div>
      </section>
    </div>
  );
}
