"use client";

import { CcLicenceBadge, OpenAccessIcon } from "@/components/badges/open-badges";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  OPEN_RESOURCES, OPEN_RESOURCE_ORGS, UNESCO_OA_TERMS_URL, isNonCommercial, isPublisherHosted, orgOf, termsFor,
  type OpenResource,
} from "@/lib/open-resources";
import { TAKEAWAYS_NOTICE, takeawaysFor, takeawaysPdfPath, type EditorialTakeaways } from "@/lib/open-resources-takeaways";
import { useTenantBranding } from "@/lib/tenant-branding-context";
import { Download, ExternalLink, BookOpenCheck, Copy, Check, Scale, Info, Copyright, PenLine, FileDown } from "lucide-react";

/**
 * "Open Resources" collection on the Books page: third-party open-access
 * publications redistributed unmodified under their own licences, with the
 * attribution, licence and third-party-image notices each licence requires.
 * Covers owned by third parties carry an explicit copyright attribution and
 * a restrictions notice. Data and sourcing notes: src/lib/open-resources.ts.
 *
 * On the Eleventh Press platform each title also carries Eleventh Press
 * Editorial Takeaways (our own commentary, clearly labelled, with a
 * no-endorsement notice) and a branded PDF of them. Tenant sites don't show
 * them, as with the Resources blog. Content: src/lib/open-resources-takeaways.ts.
 */

/** Shown for every cover whose image belongs to a third party. */
const COVER_RESTRICTION =
  "All rights reserved by the copyright holder. This image is not covered by the publication's open licence, " +
  "and Eleventh Press claims no rights in it. It is shown solely to identify the publication, as part of the " +
  "unmodified original. You may not copy, extract, crop, edit, adapt, redistribute or otherwise reuse this image " +
  "on its own (for example in other publications, websites, social media, presentations, merchandise or datasets) " +
  "without prior written permission from the copyright holder. Sharing the complete, unmodified publication under " +
  "its open licence remains permitted.";
const ALL = "All publishers";

/** Download control for a title: our hosted copy, or the publisher's own copy. */
function PdfLink({ r, className, children }: { r: OpenResource; className?: string; children: React.ReactNode }) {
  return isPublisherHosted(r) ? (
    <a href={r.pdfPath} target="_blank" rel="noopener noreferrer" className={className}
      aria-label={`Download the PDF of ${r.title} from ${orgOf(r)} (opens the publisher's site)`}>
      {children}
    </a>
  ) : (
    <a href={r.pdfPath} download className={className} aria-label={`Download PDF: ${r.title}`}>{children}</a>
  );
}

export function OpenResourcesSection() {
  const [open, setOpen] = useState<OpenResource | null>(null);
  const [org, setOrg] = useState<string>(ALL);
  const showTakeaways = useTenantBranding().isPlatform;
  const shown = org === ALL ? OPEN_RESOURCES : OPEN_RESOURCES.filter((r) => orgOf(r) === org);

  return (
    <section
      id="open-resources"
      aria-labelledby="open-resources-title"
      className="mt-8 rounded-3xl border border-[var(--royal-300)]/20 bg-gradient-to-br from-[var(--royal-100)]/60 via-transparent to-[var(--gold-300)]/10 p-5 sm:p-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow flex items-center gap-1.5"><OpenAccessIcon className="h-4" title="" /> Open Resources</p>
          <h2 id="open-resources-title" className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            Free, openly licensed publications
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A curated library of open-access reports, books, guides and studies from international organisations,
            academic publishers and research institutes, free to read, download and share under each work&apos;s own
            open licence. Every title is provided exactly as published, with full credit to its authors and publisher.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-[var(--royal-300)]/30 bg-background/60 text-primary">
          {OPEN_RESOURCES.length} titles · {OPEN_RESOURCE_ORGS.length} publishers · free
        </Badge>
      </div>

      <div role="group" aria-label="Filter by publisher" className="mt-5 flex flex-wrap gap-2">
        {[ALL, ...OPEN_RESOURCE_ORGS].map((o) => {
          const n = o === ALL ? OPEN_RESOURCES.length : OPEN_RESOURCES.filter((r) => orgOf(r) === o).length;
          const active = org === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={active}
              onClick={() => setOrg(o)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-[var(--royal-300)]/30 bg-background/60 text-foreground hover:border-primary/60"
              }`}
            >
              {o} <span className={active ? "opacity-80" : "text-muted-foreground"}>· {n}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((r) => (
          <article key={r.slug} className="pearl-card flex flex-col overflow-hidden p-0">
            <button
              type="button"
              onClick={() => setOpen(r)}
              className="group block bg-[var(--royal-100)]/40 p-3"
              aria-label={`View details: ${r.title}`}
            >
              <img
                src={r.coverPath}
                alt={`Cover of ${r.title}${r.subtitle ? `: ${r.subtitle}` : ""}`}
                loading="lazy"
                decoding="async"
                className="mx-auto aspect-[3/4] max-h-72 w-auto rounded-md object-contain sm:max-h-none sm:w-full shadow-md transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {r.coverKind === "tile" ? (
                <span className="mt-2 flex items-start justify-center gap-1 text-center text-[0.6rem] leading-snug text-muted-foreground">
                  <Info className="mt-px h-2.5 w-2.5 shrink-0" aria-hidden />
                  <span>Identification tile · original cover not reproduced</span>
                </span>
              ) : r.coverRights && (
                <span className="mt-2 flex items-start justify-center gap-1 text-center text-[0.6rem] leading-snug text-muted-foreground">
                  <Copyright className="mt-px h-2.5 w-2.5 shrink-0" aria-hidden />
                  <span>{r.coverRights.label} · cover image not openly licensed</span>
                </span>
              )}
            </button>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="border-[var(--royal-300)]/30 bg-[var(--royal-100)]/50 text-[0.6rem] text-primary">{r.type}</Badge>
                <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] text-muted-foreground">
                  <OpenAccessIcon className="h-3 w-3" />
                  {r.licence.code}
                </span>
                {showTakeaways && takeawaysFor(r.slug) && (
                  <Badge variant="outline" className="border-[var(--gold-300)]/50 bg-[var(--gold-300)]/10 text-[0.6rem] text-[var(--gold-600)] dark:text-[var(--gold-300)]">
                    <PenLine className="mr-0.5 h-2.5 w-2.5" aria-hidden /> Takeaways
                  </Badge>
                )}
              </div>
              <h3 className="mt-2 line-clamp-2 font-display text-sm font-semibold leading-snug">{r.title}</h3>
              {r.subtitle && <p className="mt-0.5 line-clamp-2 text-xs italic text-muted-foreground">{r.subtitle}</p>}
              <p className="mt-2 line-clamp-4 flex-1 text-xs leading-relaxed text-muted-foreground">{r.summary}</p>
              <p className="mt-2 text-[0.65rem] text-muted-foreground">{r.rightsHolder} · {r.pages} pp.</p>
              <div className="mt-3 flex gap-2 border-t border-[var(--royal-300)]/10 pt-3">
                <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => setOpen(r)}>
                  <Info className="mr-1 h-3 w-3" /> Details
                </Button>
                <Button asChild size="sm" className="h-8 flex-1 text-xs">
                  <PdfLink r={r}>
                    {isPublisherHosted(r)
                      ? <><ExternalLink className="mr-1 h-3 w-3" /> PDF at {orgOf(r)}</>
                      : <><Download className="mr-1 h-3 w-3" /> PDF</>}
                  </PdfLink>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-6 flex items-start gap-2 text-[0.7rem] leading-relaxed text-muted-foreground">
        <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          These works are not Eleventh Press publications. They are redistributed free of charge and without modification
          under their open licences (or, where a publisher&apos;s terms call for it, linked to the publisher&apos;s own copy);
          all rights not granted by those licences remain with their holders. Their inclusion does not imply endorsement
          of, or affiliation with, Eleventh Press International Publishing™ by the publishers or authors. Each title&apos;s
          details name its licence and any publisher terms of use; use of UNESCO works is subject to the{" "}
          <a href={UNESCO_OA_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            UNESCO Open Access terms of use
          </a>, and titles under a NonCommercial licence are provided for non-commercial use only.
        </span>
      </p>
      <p className="mt-2 flex items-start gap-2 text-[0.7rem] leading-relaxed text-muted-foreground">
        <Copyright className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-medium text-foreground">Image rights notice.</span> Cover images and photographs credited
          to third parties (marked “cover image not openly licensed”) remain the exclusive property of their respective
          copyright holders, named in each title&apos;s details. They are excluded from the open licences and may not be
          reused separately without the holder&apos;s prior written permission. Where a cover may not be shown at all, a
          plain Eleventh Press identification tile is used instead. Names, logos and emblems shown on the covers,
          including the UNESCO, UNICEF, World Health Organization, World Bank Group, Springer Nature and Commonwealth of
          Learning logos, the ASEAN emblem, the Education 2030 and Sustainable Development Goals marks and other partner
          and funder logos, belong to their owners, are not licensed under Creative Commons, and may not be reused
          without their authorization.
        </span>
      </p>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        {open && <ResourceDetail r={open} takeaways={showTakeaways ? takeawaysFor(open.slug) : null} />}
      </Dialog>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-xs">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function TakeawaysPanel({ r, t }: { r: OpenResource; t: EditorialTakeaways }) {
  return (
    <section
      aria-labelledby={`takeaways-${r.slug}`}
      data-testid="editorial-takeaways"
      className="relative overflow-hidden rounded-xl border border-[var(--gold-300)]/40 bg-gradient-to-br from-[var(--royal-100)]/60 to-[var(--gold-300)]/10 p-4 sm:p-5"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--gold-500)]" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><PenLine className="h-3.5 w-3.5" /> Editorial · {t.code}</p>
          <h4 id={`takeaways-${r.slug}`} className="mt-1 font-display text-base font-semibold sm:text-lg">
            Eleventh Press Editorial Takeaways
          </h4>
        </div>
        <Button asChild size="sm" className="h-8 text-xs">
          <a href={takeawaysPdfPath(r.slug)} download aria-label={`Download the Eleventh Press takeaways for ${r.title} as a PDF`}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" /> Takeaways PDF
          </a>
        </Button>
      </div>

      <ol className="mt-4 space-y-3">
        {t.takeaways.map((k, i) => (
          <li key={k.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">{k.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{k.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-lg bg-background/70 p-3">
        <p className="text-xs font-semibold">Why it matters: the Eleventh Press view</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.whyItMatters}</p>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold">Questions for further research</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {t.researchQuestions.map((q) => <li key={q}>{q}</li>)}
        </ul>
      </div>

      <p className="mt-4 flex items-start gap-1.5 border-t border-[var(--royal-300)]/15 pt-3 text-[0.65rem] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>{TAKEAWAYS_NOTICE}</span>
      </p>
    </section>
  );
}

function ResourceDetail({ r, takeaways }: { r: OpenResource; takeaways: EditorialTakeaways | null }) {
  const [copied, setCopied] = useState(false);
  const terms = termsFor(r);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the citation stays selectable */
    }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <p className="eyebrow">{r.series || r.type}</p>
        <DialogTitle className="font-display text-xl leading-snug sm:text-2xl">{r.title}</DialogTitle>
        {r.subtitle && <DialogDescription className="italic">{r.subtitle}</DialogDescription>}
      </DialogHeader>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <img src={r.coverPath} alt={`Cover of ${r.title}`} className="w-full rounded-md shadow-lg" />
          <p className="text-[0.65rem] leading-snug text-muted-foreground">{r.coverCredit}</p>
          {r.coverRights && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[0.65rem] leading-snug">
              <p className="flex items-center gap-1 font-semibold">
                <Copyright className="h-3 w-3" /> {r.coverKind === "tile" ? "Original cover image rights" : "Cover image rights"}
              </p>
              {r.coverKind === "tile" && (
                <p className="mt-1 text-muted-foreground">The original cover is not reproduced on this page.</p>
              )}
              <p className="mt-1">
                <span className="font-medium">Copyright holder:</span> {r.coverRights.owner}.
              </p>
              <p className="mt-1 text-muted-foreground">
                <span className="font-medium text-foreground">Credited in the publication as:</span> “{r.coverRights.printedCredit}”.
              </p>
              <p className="mt-1 text-muted-foreground">{r.coverRights.basis}</p>
              <p className="mt-1 text-muted-foreground">
                <span className="font-medium text-foreground">Restrictions:</span> {COVER_RESTRICTION}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button asChild size="sm">
              <PdfLink r={r}>
                {isPublisherHosted(r)
                  ? <><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> PDF at {orgOf(r)} ({r.fileSizeMb} MB)</>
                  : <><Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF ({r.fileSizeMb} MB)</>}
              </PdfLink>
            </Button>
            {!isPublisherHosted(r) && (
              <Button asChild size="sm" variant="outline">
                <a href={r.pdfPath} target="_blank" rel="noopener noreferrer"><BookOpenCheck className="mr-1.5 h-3.5 w-3.5" /> Read online</a>
              </Button>
            )}
            <Button asChild size="sm" variant="ghost" className="text-xs">
              <a href={r.doi ? `https://doi.org/${r.doi}` : r.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3 w-3" /> Original source
              </a>
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div className="space-y-3 text-sm leading-relaxed">
            {r.description.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold">Inside this publication</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {r.highlights.map((h) => <li key={h}>{h}</li>)}
            </ul>
            <p className="mt-2 text-xs"><span className="font-medium">Who it&apos;s for:</span> <span className="text-muted-foreground">{r.audience}</span></p>
          </div>

          {takeaways && <TakeawaysPanel r={r} t={takeaways} />}

          <dl className="divide-y divide-[var(--royal-300)]/10 rounded-xl border border-[var(--royal-300)]/15 px-4 py-1">
            <Field label="Author(s)">{r.creators}</Field>
            <Field label="Publisher">{r.publisher}</Field>
            <Field label="Year">{r.year}</Field>
            <Field label="Pages · Language">{r.pages} pages · {r.language}</Field>
            {r.isbn && <Field label="ISBN">{r.isbn}</Field>}
            {r.issn && <Field label="ISSN">{r.issn}</Field>}
            {r.reportCode && <Field label="Document code">{r.reportCode}</Field>}
            {r.doi && (
              <Field label="DOI">
                <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">https://doi.org/{r.doi}</a>
              </Field>
            )}
            {r.funding && <Field label="Funding">{r.funding}</Field>}
          </dl>

          <div className="rounded-xl bg-[var(--royal-100)]/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-sm font-semibold">How to cite</h4>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={copy}>
                {copied ? <><Check className="mr-1 h-3 w-3" /> Copied</> : <><Copy className="mr-1 h-3 w-3" /> Copy</>}
              </Button>
            </div>
            <p className="mt-1 select-all text-xs leading-relaxed">{r.citation}</p>
          </div>

          <div className="rounded-xl border border-[var(--royal-300)]/15 p-4 text-xs leading-relaxed">
            <h4 className="flex items-center gap-1.5 font-display text-sm font-semibold"><Scale className="h-3.5 w-3.5" /> Credits &amp; licence</h4>
            <p className="mt-2">
              <span className="font-medium">{r.rightsHolder}.</span> This publication is available in Open Access under the{" "}
              <a href={r.licence.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{r.licence.name} ({r.licence.code})</a>{" "}
              licence. <CcLicenceBadge code={r.licence.code} className="ml-1 align-middle" />
              {terms && (
                <>
                  {" "}By using its content, users accept the{" "}
                  <a href={terms.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{terms.label}</a>.
                </>
              )}
            </p>
            {r.licenceSource && <p className="mt-2"><span className="font-medium">Licence source:</span> {r.licenceSource}</p>}
            {r.extractOf && <p className="mt-2"><span className="font-medium">Chapter extract:</span> {r.extractOf}</p>}
            {r.coverRights && (
              <p className="mt-2">
                <span className="font-medium">Cover image:</span> {r.coverRights.label}, copyright holder{" "}
                {r.coverRights.owner}. Not covered by the open licence; all rights reserved (see “Cover image rights”).
              </p>
            )}
            {isNonCommercial(r) && (
              <p className="mt-2">This licence does not permit commercial use. Eleventh Press provides it free of charge, for non-commercial purposes only.</p>
            )}
            {r.thirdPartyNotice && <p className="mt-2">{r.thirdPartyNotice}</p>}
            <p className="mt-2">
              {isPublisherHosted(r)
                ? `Not redistributed by Eleventh Press International Publishing™: the PDF links go to ${orgOf(r)}'s own copy.`
                : "Redistributed by Eleventh Press International Publishing™ without changes to the original file."} The designations
              employed and the presentation of material do not imply the expression of any opinion whatsoever on the part of
              the publisher concerning the legal status of any country, territory, city or area or of its authorities. The ideas
              and opinions expressed are those of the authors and do not necessarily reflect those of the publisher, nor do they
              commit it. No endorsement of Eleventh Press by the publisher or authors is implied.
            </p>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
