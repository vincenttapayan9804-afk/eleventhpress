"use client";

import { NextIntlClientProvider } from "next-intl";
import { useApp, type Locale } from "@/lib/store";

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import fil from "@/messages/fil.json";
import zhHans from "@/messages/zh-Hans.json";

const MESSAGES: Record<Locale, any> = {
  en,
  es,
  fr,
  fil,
  "zh-Hans": zhHans,
};

/**
 * Locale switching here is purely client-side state (the app has no
 * URL-based routing to begin with — see src/app/page.tsx's view-key
 * pattern), so all message catalogs are bundled up front and swapping
 * useApp's locale re-renders NextIntlClientProvider with new messages
 * instantly, with no page reload or network round-trip.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useApp((s) => s.locale);
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
