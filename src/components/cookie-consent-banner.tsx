"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Cookie, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import {
  COOKIE_CATEGORIES,
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_INVENTORY,
  OPEN_COOKIE_PREFERENCES_EVENT,
  isCookieConsentChoice,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";

const subscribeNever = () => () => {};

/**
 * True only once hydrated on the client — same useSyncExternalStore
 * pattern as src/components/theme-toggle.tsx (a useState+useEffect
 * "mounted" pair trips this repo's react-hooks/set-state-in-effect lint).
 * document.cookie is only read once this is true.
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
 * Records a choice. The server route also deletes the HTTP-only reader_key
 * cookie when consent is withdrawn; if that call fails (offline, no CSRF
 * token yet) the choice is still saved client-side so the visitor isn't
 * asked again.
 */
async function saveChoice(choice: CookieConsentChoice) {
  try {
    await apiFetch("/api/cookie-consent", { method: "POST", body: JSON.stringify({ choice }) });
  } catch {
    /* fall through to the client-side write */
  }
  if (readConsentCookie() !== choice) writeConsentCookie(choice);
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGED_EVENT));
}

/**
 * Cookie consent: a first-visit popup (Accept all / Necessary only /
 * Customize) plus a preferences dialog, reopened any time from the footer's
 * "Cookie settings" or the Cookie Policy page via
 * OPEN_COOKIE_PREFERENCES_EVENT. Necessary and preference storage are always
 * on and are disclosed rather than toggled; the one optional cookie is
 * reader_key (anonymous magazine metering, see src/lib/paywall-meter.ts).
 * The platform sets no analytics or advertising cookies, and the dialog
 * says so instead of offering a switch that does nothing. Full inventory:
 * COOKIE_INVENTORY in src/lib/cookie-consent.ts.
 */
export function CookieConsentBanner() {
  const mounted = useHasMounted();
  const reduceMotion = useReducedMotion();
  const [decided, setDecided] = useState<CookieConsentChoice | null | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metering, setMetering] = useState(false);
  const [saving, setSaving] = useState(false);

  // undefined = not read yet; read lazily on first client render.
  const current = decided === undefined && mounted ? readConsentCookie() : decided ?? null;

  useEffect(() => {
    const open = () => {
      setMetering(readConsentCookie() === "all");
      setDialogOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open);
  }, []);

  async function choose(choice: CookieConsentChoice) {
    setSaving(true);
    await saveChoice(choice);
    setSaving(false);
    setDecided(choice);
    setDialogOpen(false);
  }

  if (!mounted) return null;
  const showBanner = !current && !dialogOpen;

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            key="cookie-banner"
            role="dialog"
            aria-modal="false"
            aria-labelledby="cookie-consent-title"
            aria-describedby="cookie-consent-description"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : 0.6 }}
            className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[min(440px,calc(100vw-3rem))]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="glass-royal rounded-[1.4rem] p-[3px] shadow-[0_24px_60px_-20px_oklch(0.30_0.13_293/0.55)]">
              <div className="rounded-[1.25rem] border border-white/10 bg-background/95 p-4 backdrop-blur-xl sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--royal-400)] to-[var(--royal-700)] text-white shadow-[0_6px_16px_-6px_oklch(0.42_0.18_295/0.8)]">
                    <Cookie className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p id="cookie-consent-title" className="font-display text-base font-semibold leading-tight text-foreground">
                      Your privacy, your choice
                    </p>
                    <p id="cookie-consent-description" className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                      We use strictly necessary cookies to keep you signed in and secure. With your permission we&apos;ll also set
                      one optional cookie to count free magazine articles for readers who aren&apos;t signed in. No advertising,
                      no cross-site tracking.{" "}
                      <a href="/cookie-policy" className="font-medium text-primary underline-offset-2 hover:underline">
                        Cookie Policy
                      </a>
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="col-span-2 order-3 sm:order-none sm:col-span-1 sm:mr-auto"
                    onClick={() => {
                      setMetering(false);
                      setDialogOpen(true);
                    }}
                  >
                    <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Customize
                  </Button>
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => choose("necessary")}>
                    Necessary only
                  </Button>
                  <Button size="sm" className="btn-royal-glow" disabled={saving} onClick={() => choose("all")}>
                    Accept all
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <ShieldCheck className="h-5 w-5 text-primary" /> Cookie preferences
            </DialogTitle>
            <DialogDescription>
              Choose which cookies Eleventh Press may use on this device. You can change this any time from the
              &ldquo;Cookie settings&rdquo; link in the footer.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2.5">
            {COOKIE_CATEGORIES.map((cat) => {
              const items = COOKIE_INVENTORY.filter((c) => c.category === cat.id);
              const checked = cat.required || (cat.id === "metering" && metering);
              const switchId = `cookie-cat-${cat.id}`;
              return (
                <li key={cat.id} className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label htmlFor={switchId} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                        {cat.label}
                        {cat.required && (
                          <Badge variant="secondary" className="text-[10px]">
                            Always on
                          </Badge>
                        )}
                        {cat.unused && (
                          <Badge variant="outline" className="text-[10px]">
                            Not used
                          </Badge>
                        )}
                      </label>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cat.description}</p>
                    </div>
                    <Switch
                      id={switchId}
                      checked={checked}
                      disabled={cat.required || cat.unused}
                      onCheckedChange={(v) => cat.id === "metering" && setMetering(v)}
                      aria-label={`${cat.label} cookies`}
                      className="mt-0.5 shrink-0"
                    />
                  </div>
                  {items.length > 0 && (
                    <details className="group mt-2">
                      <summary className="cursor-pointer select-none text-[11px] font-medium text-primary">
                        {items.length} item{items.length === 1 ? "" : "s"} — details
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {items.map((it) => (
                          <li key={it.name} className="rounded-lg bg-background/70 px-2.5 py-2 text-[11px] leading-snug">
                            <span className="font-mono font-medium text-foreground">{it.name}</span>
                            <span className="text-muted-foreground"> · {it.kind} · {it.duration}</span>
                            <p className="mt-0.5 text-muted-foreground">{it.purpose}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>

          <DialogFooter className="gap-2 sm:justify-between">
            <a href="/cookie-policy" className="self-center text-xs font-medium text-primary underline-offset-2 hover:underline">
              Read the full Cookie Policy
            </a>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" size="sm" disabled={saving} onClick={() => choose(metering ? "all" : "necessary")}>
                Save choices
              </Button>
              <Button size="sm" disabled={saving} onClick={() => choose("all")}>
                Accept all
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
