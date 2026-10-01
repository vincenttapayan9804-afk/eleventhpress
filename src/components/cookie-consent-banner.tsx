"use client";

import { useState, useSyncExternalStore } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  isCookieConsentChoice,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";

const subscribeNever = () => () => {};

/**
 * True only once hydrated on the client — same useSyncExternalStore
 * pattern as src/components/theme-toggle.tsx, chosen there specifically
 * to avoid a useState+useEffect("mounted") pair, which this repo's
 * `bun run lint` flags (react-hooks/set-state-in-effect). Reading
 * document.cookie below only ever happens once this is true, so it never
 * runs during SSR or the pre-hydration first client render.
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

function readConsentCookie(): CookieConsentChoice | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_CONSENT_COOKIE_NAME}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isCookieConsentChoice(value) ? value : null;
}

function writeConsentCookie(choice: CookieConsentChoice) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${choice}; path=/; max-age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

/**
 * Cookie consent banner — epip_session, epip_csrf, and this very
 * preference cookie are all strictly necessary and set unconditionally
 * (see src/components/views/privacy-view.tsx's Cookie section); the one
 * choice this banner actually gates is reader_key, the anonymous-reader
 * identifier src/lib/paywall-meter.ts uses to enforce the magazine
 * section's free-articles-per-month limit. Declining doesn't block
 * anything — GET /api/magazine-issues/[id] simply never sets that cookie
 * or records a meter event for a reader who hasn't opted in, which in
 * practice means anonymous magazine reading stays unmetered for them
 * (there's nothing to count without a stable identifier) rather than
 * silently defaulting to fail-closed.
 */
export function CookieConsentBanner() {
  const mounted = useHasMounted();
  const [dismissed, setDismissed] = useState(false);
  const { setView } = useApp();

  if (!mounted || dismissed || readConsentCookie()) {
    return null;
  }

  function choose(choice: CookieConsentChoice) {
    writeConsentCookie(choice);
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm sm:p-5"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <Cookie className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p id="cookie-consent-description" className="flex-1 text-xs text-muted-foreground sm:text-sm">
          <span className="font-medium text-foreground">Cookies on this site.</span>{" "}
          Your session and a security token are strictly necessary and always on. We also use one
          optional cookie to apply the free-article limit on magazine content for readers who
          aren&apos;t signed in — accept it to keep a fair running count across visits, or decline
          and anonymous magazine reading stays unmetered. See the{" "}
          <button type="button" onClick={() => setView("privacy")} className="underline hover:text-foreground">
            Privacy page
          </button>{" "}
          for details.
        </p>
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("necessary")}>
            Necessary only
          </Button>
          <Button size="sm" onClick={() => choose("all")}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
