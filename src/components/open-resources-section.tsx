"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { OPEN_RESOURCES, UNESCO_OA_TERMS_URL, type OpenResource } from "@/lib/open-resources";
import { Download, ExternalLink, BookOpenCheck, Copy, Check, Scale, Info } from "lucide-react";

/**
 * "Open Resources" collection on the Books page: third-party open-access
 * publications redistributed unmodified under their own licences, with the
 * attribution, licence and third-party-image notices each licence requires.
 * Data and sourcing notes: src/lib/open-resources.ts.
 */
export function OpenResourcesSection() {
  const [open, setOpen] = useState<OpenResource | null>(null);

  return (
    <section
      id="open-resources"
      aria-labelledby="open-resources-title"
      className="mt-8 rounded-3xl border border-[var(--royal-300)]/20 bg-gradient-to-br from-[var(--royal-100)]/60 via-transparent to-[var(--gold-300)]/10 p-5 sm:p-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow flex items-center gap-1.5"><BookOpenCheck className="h-3.5 w-3.5" /> Open Resources</p>
          <h2 id="open-resources-title" className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            Free, openly licensed publications
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A curated library of open-access reports, books, briefs and magazines from trusted public institutions,
            free to read, download and share under each work&apos;s own open licence. Every title is provided
            exactly as published, with full credit to its authors and publisher.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-[var(--royal-300)]/30 bg-background/60 text-primary">
          {OPEN_RESOURCES.length} titles · free download
        </Badge>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {OPEN_RESOURCES.map((r) => (
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
            </button>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="border-[var(--royal-300)]/30 bg-[var(--royal-100)]/50 text-[0.6rem] text-primary">{r.type}</Badge>
                <span className="font-mono text-[0.6rem] text-muted-foreground">{r.licence.code}</span>
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
                  <a href={r.pdfPath} download aria-label={`Download PDF: ${r.title}`}>
                    <Download className="mr-1 h-3 w-3" /> PDF
                  </a>
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
          under their open licences; all rights not granted by those licences remain with their holders. Their inclusion
          does not imply endorsement of, or affiliation with, Eleventh Press International Publishing™ by the publishers
          or authors. Use of UNESCO works is subject to the{" "}
          <a href={UNESCO_OA_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            UNESCO Open Access terms of use
          </a>.
        </span>
      </p>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        {open && <ResourceDetail r={open} />}
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

function ResourceDetail({ r }: { r: OpenResource }) {
  const [copied, setCopied] = useState(false);
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
          <div className="flex flex-col gap-2">
            <Button asChild size="sm">
              <a href={r.pdfPath} download><Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF ({r.fileSizeMb} MB)</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={r.pdfPath} target="_blank" rel="noopener noreferrer"><BookOpenCheck className="mr-1.5 h-3.5 w-3.5" /> Read online</a>
            </Button>
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
              licence. By using its content, users accept the{" "}
              <a href={UNESCO_OA_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">terms of use of the UNESCO Open Access Repository</a>.
            </p>
            {r.licence.code.includes("NC") && (
              <p className="mt-2">This licence does not permit commercial use. Eleventh Press provides it free of charge, for non-commercial purposes only.</p>
            )}
            {r.thirdPartyNotice && <p className="mt-2">{r.thirdPartyNotice}</p>}
            <p className="mt-2">
              Redistributed by Eleventh Press International Publishing™ without changes to the original file. The designations
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
