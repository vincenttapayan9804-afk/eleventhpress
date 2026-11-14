"use client";

import { useTranslations } from "next-intl";
import { POWERED_BY_CREDIT, POWERED_BY_URL } from "@/lib/powered-by";
import { useApp } from "@/lib/store";
import {
  Cookie,
  Globe,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  Music2,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { DOI_REGISTRAR } from "@/lib/site";
import { useTenantBranding, isWhitelabel, type ClientBranding } from "@/lib/tenant-branding-context";

const SOCIAL_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  facebook: { icon: Facebook, label: "Facebook" },
  x: { icon: Twitter, label: "X (Twitter)" },
  linkedin: { icon: Linkedin, label: "LinkedIn" },
  instagram: { icon: Instagram, label: "Instagram" },
  youtube: { icon: Youtube, label: "YouTube" },
  tiktok: { icon: Music2, label: "TikTok" },
  researchgate: { icon: GraduationCap, label: "ResearchGate" },
};

/** Organization contact block — renders only the details the tenant has set. */
function FooterContact({ branding }: { branding: ClientBranding }) {
  const emails = [branding.officialEmail, branding.supportEmail].filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
  const phones = [branding.phone, branding.phoneAlt].filter((v): v is string => !!v);
  const socials = Object.entries(branding.socialLinks ?? {}).filter(([k, v]) => v && SOCIAL_ICONS[k]);
  if (!emails.length && !phones.length && !branding.address && !branding.websiteUrl && !socials.length) return null;
  return (
    <div className="mt-5 space-y-2 text-sm text-muted-foreground" data-testid="footer-contact">
      {emails.map((e) => (
        <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 hover:text-primary transition-colors">
          <Mail className="h-3.5 w-3.5 shrink-0" /> {e}
        </a>
      ))}
      {phones.map((p) => (
        <a key={p} href={`tel:${p.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-2 hover:text-primary transition-colors">
          <Phone className="h-3.5 w-3.5 shrink-0" /> {p}
        </a>
      ))}
      {branding.websiteUrl && (
        <a href={branding.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary transition-colors">
          <Globe className="h-3.5 w-3.5 shrink-0" /> {branding.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      )}
      {branding.address && (
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span className="whitespace-pre-line">{branding.address}</span>
        </p>
      )}
      {socials.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {socials.map(([key, url]) => {
            const { icon: Icon, label } = SOCIAL_ICONS[key];
            return (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                title={label}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SiteFooter() {
  const setView = useApp((s) => s.setView);
  const t = useTranslations("footer");
  const branding = useTenantBranding();
  const whitelabel = isWhitelabel(branding);
  return (
    <footer className="mt-auto">
      <div className="royal-divider" />
      <div className="glass border-t border-[var(--royal-300)]/10">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3">
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt={branding.siteName || "Eleventh Press"} className="h-10 w-auto max-w-[140px] object-contain" />
                ) : (
                  <span className="wax-mark">
                    <span className="wax-mark-text">EP</span>
                  </span>
                )}
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    {branding.siteName || "Eleventh Press International Publishing™"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {branding.tagline || t("tagline", { registrar: DOI_REGISTRAR })}
                  </p>
                </div>
              </div>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
                {whitelabel
                  ? `The research publishing platform of ${branding.siteName || branding.tenantName}: peer review, open access publishing, research administration and institutional analytics in one place.`
                  : t("description", { registrar: DOI_REGISTRAR })}
              </p>
              {!whitelabel && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("issnLine")}
                </p>
              )}
              <FooterContact branding={branding} />
            </div>

            <div>
              <p className="eyebrow mb-3">{t("exploreLabel")}</p>
              <ul className="space-y-2.5 text-sm">
                <li><button onClick={() => setView("home")} className="text-muted-foreground hover:text-primary transition-colors">{t("home")}</button></li>
                <li><button onClick={() => setView("browse")} className="text-muted-foreground hover:text-primary transition-colors">{t("allArticles")}</button></li>
                <li><button onClick={() => setView("authors")} className="text-muted-foreground hover:text-primary transition-colors">{t("authorsDirectory")}</button></li>
                <li><button onClick={() => setView("experts")} className="text-muted-foreground hover:text-primary transition-colors">{t("expertsDirectory")}</button></li>
                <li><button onClick={() => setView("resources")} className="text-muted-foreground hover:text-primary transition-colors">{t("resources")}</button></li>
                <li><button onClick={() => setView("about")} className="text-muted-foreground hover:text-primary transition-colors">{t("aboutJournal")}</button></li>
                <li><button onClick={() => setView("faqs")} className="text-muted-foreground hover:text-primary transition-colors">{t("faqs")}</button></li>
                <li><button onClick={() => setView("pricing")} className="text-muted-foreground hover:text-primary transition-colors">Pricing</button></li>
                <li><a href="/api/oai-pmh?verb=Identify" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"><Globe className="h-3 w-3" /> {t("oaiEndpoint")}</a></li>
                <li><a href="/openapi.json" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"><Globe className="h-3 w-3" /> {t("apiSpec")}</a></li>
              </ul>
            </div>

            <div>
              <p className="eyebrow mb-3">{t("policiesLabel")}</p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>{t("policyOpenAccess")}</li>
                <li>{t("policyPeerReview")}</li>
                <li>{t("policyCrossref", { registrar: DOI_REGISTRAR })}</li>
                <li>
                  <button
                    onClick={() => setView("privacy")}
                    data-testid="footer-nav-privacy"
                    className="text-left underline-offset-2 hover:text-primary hover:underline transition-colors"
                  >
                    {t("policyGdpr")}
                  </button>
                </li>
                <li>{t("policyPci")}</li>
                <li>
                  <button
                    onClick={() => setView("terms")}
                    data-testid="footer-nav-terms"
                    className="text-left underline-offset-2 hover:text-primary hover:underline transition-colors"
                  >
                    {t("termsOfService")}
                  </button>
                </li>
                <li>
                  <a href="/cookie-policy" className="underline-offset-2 hover:text-primary hover:underline transition-colors">
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <button
                    onClick={openCookiePreferences}
                    data-testid="footer-cookie-settings"
                    className="inline-flex items-center gap-1 text-left underline-offset-2 hover:text-primary hover:underline transition-colors"
                  >
                    <Cookie className="h-3 w-3" /> Cookie settings
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setView("accessibility")}
                    data-testid="footer-nav-accessibility"
                    className="text-left underline-offset-2 hover:text-primary hover:underline transition-colors"
                  >
                    {t("accessibilityStatement")}
                  </button>
                </li>
                <li>
                  <a href="/status" className="text-left underline-offset-2 hover:text-primary hover:underline transition-colors">
                    Platform status
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[var(--royal-300)]/10 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            {whitelabel ? (
              <p>
                © {new Date().getFullYear()} {branding.siteName || branding.tenantName}.{" "}
                {/* Fixed platform credit — not a branding setting, so tenants can't change or remove it. */}
                <a
                  href={branding.source === "portal" ? "/t/exit" : POWERED_BY_URL}
                  {...(branding.source === "portal" ? {} : { target: "_blank", rel: "noopener" })}
                  data-testid="powered-by"
                  className="underline-offset-2 hover:text-primary hover:underline"
                >
                  {POWERED_BY_CREDIT}
                </a>
              </p>
            ) : (
              <p>{t("copyright", { year: new Date().getFullYear() })}</p>
            )}
            <div className="flex items-center gap-4">
              {!whitelabel && (
              <button
                onClick={() => setView("adminPortal")}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              >
                <ShieldCheck className="h-3 w-3" /> Admin Portal
              </button>
              )}
              <p className="font-mono">{t("indexedLine", { registrar: DOI_REGISTRAR })}</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
