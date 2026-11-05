"use client";

import { useSyncExternalStore } from "react";
import { Cookie, Database, Globe2, Mail, Settings2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COOKIE_CATEGORIES,
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_INVENTORY,
  COOKIE_POLICY_UPDATED,
  openCookiePreferences,
} from "@/lib/cookie-consent";

function subscribeCookies(cb: () => void) {
  window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, cb);
  window.addEventListener("focus", cb);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, cb);
    window.removeEventListener("focus", cb);
  };
}
function readChoice(): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_CONSENT_COOKIE_NAME}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

const CHOICE_LABEL: Record<string, string> = {
  all: "All cookies accepted (including reader metering)",
  necessary: "Strictly necessary only",
  "": "No choice made yet",
};

/**
 * The Cookie Policy — rendered at /cookie-policy. Generated from the same
 * COOKIE_CATEGORIES / COOKIE_INVENTORY the consent dialog uses, so the
 * policy and the controls can't drift apart.
 */
export function CookiePolicyContent() {
  const choice = useSyncExternalStore(subscribeCookies, readChoice, () => "");
  const updated = new Date(`${COOKIE_POLICY_UPDATED}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="border-b border-[var(--royal-300)]/15 pb-8">
        <p className="eyebrow">Legal · Privacy</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Cookie Policy</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          How Eleventh Press International Publishing uses cookies and similar browser storage, why, for how long, and how
          you stay in control. Last updated {updated}.
        </p>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Your current setting</p>
              <p className="text-sm font-semibold text-foreground">{CHOICE_LABEL[choice] ?? CHOICE_LABEL[""]}</p>
            </div>
          </div>
          <Button onClick={openCookiePreferences} className="btn-royal-glow">
            <Cookie className="mr-1.5 h-4 w-4" /> Manage cookie preferences
          </Button>
        </div>
      </header>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-2xl font-semibold">1. What cookies are</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Cookies are small text files a website asks your browser to keep. Local storage and session storage are similar
          browser features that hold small amounts of data on your device. This policy covers all three, and applies to every
          page of this platform, including article verification pages and dashboards.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-2xl font-semibold">2. Categories we use</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {COOKIE_CATEGORIES.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                {c.label}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {c.unused ? "Not used" : c.required ? "Always on" : "Optional — asks first"}
                </span>
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-2xl font-semibold">3. Every cookie and storage item</h2>
        <p className="text-sm text-muted-foreground">All are first-party: set by this platform, for this platform only.</p>
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[640px] text-left text-xs">
            <caption className="sr-only">Cookies and browser storage used by Eleventh Press</caption>
            <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-medium">Name</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Purpose</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {COOKIE_INVENTORY.map((it) => (
                <tr key={it.name} className="border-t border-border/50 align-top">
                  <th scope="row" className="px-3 py-2.5 font-mono font-medium text-foreground">{it.name}</th>
                  <td className="px-3 py-2.5 text-muted-foreground">{it.kind}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {COOKIE_CATEGORIES.find((c) => c.id === it.category)?.label}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{it.purpose}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{it.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-2xl font-semibold">4. Third parties</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> No advertising or tracking</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              No advertising networks, social-media pixels or third-party analytics run on this platform, and none of them
              set cookies here.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Globe2 className="h-4 w-4 text-primary" /> Services that set no cookies</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Error monitoring (Sentry) reports crashes without cookies. Some dashboard fonts load from Google Fonts, which
              receives your IP address to deliver the file but sets no cookie. Linked sites (doi.org, ORCID, Zenodo) have
              their own policies once you leave this site.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-2xl font-semibold">5. Your choices</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            Change or withdraw consent any time with <strong className="text-foreground">Manage cookie preferences</strong> above
            or <strong className="text-foreground">Cookie settings</strong> in the site footer. Withdrawing consent deletes the
            optional reader_key cookie straight away.
          </li>
          <li>Declining optional cookies never blocks access to any article, book or page.</li>
          <li>
            You can also block or delete cookies in your browser settings. Blocking strictly necessary cookies will stop sign-in
            and form submission from working.
          </li>
          <li>Your choice is remembered for 12 months, after which we ask again.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-2xl font-semibold">6. Legal basis and changes</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Strictly necessary cookies and storage are used on the basis of our legitimate interest in providing a service you
          requested (exempt from consent under the EU ePrivacy Directive, Art. 5(3)). The optional reader-metering cookie is
          used only with your consent (GDPR Art. 6(1)(a)). If we ever add a cookie, we will update this page and the consent
          dialog first, and ask again where consent is needed.
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-border/70 bg-muted/30 p-5">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Mail className="h-5 w-5 text-primary" /> Questions
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          See the Privacy page for how we handle personal data and how to exercise your data-protection rights, or contact the
          editorial office through the details listed there.
        </p>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> This policy is generated from the same list the consent dialog uses, so the two
          always match.
        </p>
      </section>
    </article>
  );
}
