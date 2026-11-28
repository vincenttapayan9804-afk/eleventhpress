import { parseCcLicence } from "@/lib/licence-badge";
import { cn } from "@/lib/utils";
import { WCAG_CLAIM } from "@/lib/wcag-claim";

/**
 * Official marks, shown only where they are true:
 *  - OpenAccessIcon: the Open Access symbol (open padlock, designed by PLOS),
 *    public/badges/open-access.svg, used unaltered.
 *  - CcLicenceBadge: Creative Commons' own licence button for the licence an
 *    item is published under (public/badges/cc-*.svg, unaltered), linked to
 *    the licence deed. It renders only for a recognised CC licence code.
 *  - OrcidIcon: ORCID's official iD icon file (public/badges/orcid-id.svg),
 *    unaltered, used only beside an iD that links to the real record.
 */

export function OpenAccessIcon({ className, title = "Open access" }: { className?: string; title?: string }) {
  // An empty title makes the icon decorative, for use beside text that already
  // says "open access".
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/badges/open-access.svg" alt={title} width={13} height={20} className={cn("inline-block h-4 w-auto shrink-0 align-[-0.2em]", className)} />;
}

export function OrcidIcon({ className }: { className?: string }) {
  // Decorative: the link beside it carries the text.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/badges/orcid-id.svg" alt="" width={16} height={16} className={cn("inline-block h-4 w-4 shrink-0 align-[-0.15em]", className)} />;
}

/**
 * DORA's own "Signatory of DORA" badge (public/badges/dora-signatory.png), used
 * unaltered, as DORA gives it to signers. Platform site only. It sits on a white
 * disc so the dark lettering stays readable in dark mode.
 */
export function DoraSignatoryBadge({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/badges/dora-signatory.png" alt="Signatory of DORA" width={400} height={400} className={cn("inline-block h-16 w-16 shrink-0 rounded-full bg-white", className)} />;
}

/**
 * The Budapest Open Access Initiative logo (public/badges/boai-signatory.png), used
 * unaltered, linked to BOAI's own list of organisation signatories. Platform site only.
 */
export function BoaiSignatoryLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/badges/boai-signatory.png" alt="Signatory of the Budapest Open Access Initiative" width={429} height={158} className={cn("inline-block h-14 w-auto shrink-0", className)} />;
}

/**
 * MyData's own "MyData Signatory" badge (public/badges/mydata-signatory.svg), used
 * unaltered, as shown on MyData's public list of Declaration signatories. It sits on
 * a white panel so its dark lettering stays readable in dark mode. Platform site only.
 */
export function MyDataSignatoryBadge({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/badges/mydata-signatory.svg" alt="MyData Declaration signatory" width={720} height={281} className={cn("inline-block h-14 w-auto shrink-0 rounded-md bg-white px-2 py-1", className)} />;
}

/**
 * Eleventh Press's own signatory mark for the Sustainable Web Manifesto
 * (public/badges/sustainable-web-signatory.webp). The Manifesto publishes no badge, so
 * this is our own design (six leaves for its six principles) and does not copy or imitate
 * the Manifesto's name lettering or colours. It states a fact (we signed) and is not a
 * Manifesto certification. Platform site only.
 */
export function SustainableWebSignatoryMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/badges/sustainable-web-signatory.webp" alt="Signatory of the Sustainable Web Manifesto" width={480} height={480} className={cn("inline-block h-16 w-16 shrink-0", className)} />;
}

/** The licence buttons Creative Commons publishes; other combinations fall back to a text label. */
const CC_BUTTONS = new Set(["by", "by-sa", "by-nc", "by-nc-sa", "by-nd", "by-nc-nd"]);

export function CcLicenceBadge({
  code,
  className,
  linked = true,
  showLabel = true,
  large = false,
}: {
  /** Licence code such as "CC BY 4.0". Anything that is not a CC code renders nothing. */
  code: string | null | undefined;
  className?: string;
  /** Set false inside another link, so links are never nested. */
  linked?: boolean;
  /** Show the full licence name (with version) beside the button. */
  showLabel?: boolean;
  /** A larger button (still the official artwork, scaled in proportion) for footers. */
  large?: boolean;
}) {
  const lic = parseCcLicence(code);
  if (!lic) return null;
  const slug = lic.elements.join("-").toLowerCase();
  const body = (
    <>
      {CC_BUTTONS.has(slug) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/badges/cc-${slug}.svg`} alt="" width={72} height={25} className={cn("shrink-0", large ? "h-[40px] w-[115px]" : "h-[25px] w-[72px]")} />
      )}
      {(showLabel || !CC_BUTTONS.has(slug)) && <span>{lic.label}</span>}
    </>
  );
  const base = cn("inline-flex min-h-6 items-center gap-1.5 align-middle font-mono text-[0.65rem] font-medium text-foreground/80", className);
  if (!linked) return <span className={base} data-testid="cc-badge" role="img" aria-label={`Licence: ${lic.label}`}>{body}</span>;
  return (
    <a
      href={lic.url}
      target="_blank"
      rel="license noopener noreferrer"
      className={cn(base, "hover:text-primary")}
      aria-label={`Licence: ${lic.label} (opens the licence text)`}
      data-testid="cc-badge"
    >
      {body}
    </a>
  );
}

/**
 * W3C's official WCAG 2.2 Level AA conformance logo (public/badges/wcag2.2AA.svg,
 * unaltered), linked to W3C's explanation as W3C's usage page asks. It is a
 * claim we make ourselves, not a W3C certification, so use it only on pages
 * listed in WCAG_CLAIM.pages.
 */
export function WcagConformanceLogo({ className }: { className?: string }) {
  return (
    <a href={WCAG_CLAIM.explanationUrl} target="_blank" rel="noopener noreferrer" title="Explanation of WCAG 2 Level AA conformance" className={cn("inline-block shrink-0", className)} data-testid="wcag-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={WCAG_CLAIM.logoSrc} alt={WCAG_CLAIM.alt} width={88} height={31} className="h-[31px] w-[88px]" />
    </a>
  );
}
