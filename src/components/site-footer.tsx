"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { Globe } from "lucide-react";

export function SiteFooter() {
  const setView = useApp((s) => s.setView);
  const t = useTranslations("footer");
  return (
    <footer className="mt-auto">
      <div className="royal-divider" />
      <div className="glass border-t border-[oklch(0.76_0.11_294/0.1)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3">
                <span className="wax-mark">EP</span>
                <div>
                  <p className="font-display text-lg font-semibold text-royal-gradient">
                    Eleventh Press International Publishing
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("tagline")}
                  </p>
                </div>
              </div>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("description")}
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                {t("issnLine")}
              </p>
            </div>

            <div>
              <p className="eyebrow mb-3">{t("exploreLabel")}</p>
              <ul className="space-y-2.5 text-sm">
                <li><button onClick={() => setView("home")} className="text-muted-foreground hover:text-[oklch(0.42_0.18_295)] transition-colors">{t("home")}</button></li>
                <li><button onClick={() => setView("browse")} className="text-muted-foreground hover:text-[oklch(0.42_0.18_295)] transition-colors">{t("allArticles")}</button></li>
                <li><button onClick={() => setView("about")} className="text-muted-foreground hover:text-[oklch(0.42_0.18_295)] transition-colors">{t("aboutJournal")}</button></li>
                <li><a href="/api/oai-pmh?verb=Identify" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-[oklch(0.42_0.18_295)] transition-colors"><Globe className="h-3 w-3" /> {t("oaiEndpoint")}</a></li>
              </ul>
            </div>

            <div>
              <p className="eyebrow mb-3">{t("policiesLabel")}</p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>{t("policyOpenAccess")}</li>
                <li>{t("policyPeerReview")}</li>
                <li>{t("policyCrossref")}</li>
                <li>{t("policyGdpr")}</li>
                <li>{t("policyPci")}</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[oklch(0.76_0.11_294/0.1)] pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p>{t("copyright", { year: new Date().getFullYear() })}</p>
            <p className="font-mono">{t("indexedLine")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
