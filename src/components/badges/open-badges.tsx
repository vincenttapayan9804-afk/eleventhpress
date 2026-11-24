import { parseCcLicence } from "@/lib/licence-badge";
import { cn } from "@/lib/utils";

/**
 * Small, free-to-use marks for what the platform actually does:
 *  - OpenAccessIcon: the open-padlock symbol that stands for open access
 *    (a public-domain symbol; this is our own drawing of it).
 *  - CcLicenceBadge: the Creative Commons licence an item is published under,
 *    linked to the licence text. It only renders for a recognised CC code.
 *  - OrcidIcon: the ORCID iD icon, used only beside an iD that is linked to
 *    the real record at orcid.org, as ORCID's brand rules ask.
 */

export function OpenAccessIcon({ className, title = "Open access" }: { className?: string; title?: string }) {
  // An empty title makes the icon decorative (hidden from screen readers),
  // for use beside text that already says "open access".
  const decorative = title === "";
  return (
    <svg
      viewBox="0 0 24 24"
      {...(decorative ? { "aria-hidden": true, focusable: "false" } : { role: "img", "aria-label": title })}
      className={cn("inline-block h-4 w-4 shrink-0 align-[-0.15em]", className)}
    >
      {!decorative && <title>{title}</title>}
      <path d="M8 11V7a4 4 0 0 1 7.6-1.7" fill="none" stroke="#f68212" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="5" y="11" width="14" height="10" rx="2" fill="#f68212" />
      <circle cx="12" cy="15.2" r="1.6" fill="#fff" />
      <rect x="11.2" y="15.4" width="1.6" height="3" rx="0.6" fill="#fff" />
    </svg>
  );
}

export function OrcidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("inline-block h-4 w-4 shrink-0 align-[-0.15em]", className)}>
      <circle cx="12" cy="12" r="12" fill="#a6ce39" />
      <circle cx="8.2" cy="6.6" r="1.1" fill="#fff" />
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="10.5" fill="#fff">iD</text>
    </svg>
  );
}

export function CcLicenceBadge({
  code,
  className,
  linked = true,
}: {
  /** Licence code such as "CC BY 4.0". Anything that is not a CC code renders nothing. */
  code: string | null | undefined;
  className?: string;
  /** Set false inside another link, so links are never nested. */
  linked?: boolean;
}) {
  const lic = parseCcLicence(code);
  if (!lic) return null;
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[0.5rem] font-bold leading-none"
      >
        cc
      </span>
      <span>{lic.label}</span>
    </>
  );
  const base = cn(
    "inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[0.65rem] font-medium text-foreground/80",
    className,
  );
  if (!linked) return <span className={base} data-testid="cc-badge">{body}</span>;
  return (
    <a
      href={lic.url}
      target="_blank"
      rel="license noopener noreferrer"
      className={cn(base, "hover:border-primary hover:text-primary")}
      aria-label={`Licence: ${lic.label} (opens the licence text)`}
      data-testid="cc-badge"
    >
      {body}
    </a>
  );
}
