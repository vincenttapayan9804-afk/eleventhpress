"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { editorialSerif } from "@/lib/fonts-editorial";
import {
  OPEN_EDITION_BYLINE,
  OPEN_EDITION_GUIDANCE,
  OPEN_EDITION_PRINCIPLES,
  OPEN_EDITION_RIGHTS_DETAIL,
  openEditionCopyright,
  readingMinutes,
  type OpenEditionIssue,
  type OpenEditionPiece,
  type VerificationStatus,
} from "@/lib/open-edition";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Clock, Download, ShieldCheck } from "lucide-react";

/**
 * Reader for an Open Edition issue (src/lib/open-edition.ts): the issue
 * home (cover, editor's note, contents, standards) and a print-magazine
 * article page for each piece. The open piece is kept in the URL hash
 * (/magazines/<issue>#<piece>) so articles can be linked and Back returns
 * to the contents.
 */

const STATUS_LABEL: Record<VerificationStatus, string> = {
  source: "Checked at source",
  document: "Checked in source document",
  reported: "Reported; awaiting official confirmation",
};

const STATUS_CLASS: Record<VerificationStatus, string> = {
  source: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  document: "border-primary/40 text-primary",
  reported: "border-amber-600/50 text-amber-700 dark:text-amber-400",
};

function issueDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function pieceFromHash(issue: OpenEditionIssue): string | null {
  if (typeof window === "undefined") return null;
  const slug = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return issue.pieces.some((p) => p.slug === slug) ? slug : null;
}

function IssueCover({ issue, className = "" }: { issue: OpenEditionIssue; className?: string }) {
  return (
    <div className={`oe-cover ${className}`} role="img" aria-label={`Cover of ${issue.series}, Vol. ${issue.volume}, No. ${issue.issueNumber}: ${issue.title} ${issue.titleItalic}`}>
      <img src={issue.cover} alt="" />
      <div className="oe-cover-mast"><span>Eleventh Press</span><span>No. {String(issue.issueNumber).padStart(2, "0")}</span></div>
      <div className="oe-cover-logo">Open<i>.</i></div>
      <div className="oe-cover-title">{issue.title} <i>{issue.titleItalic}</i></div>
      <div className="oe-cover-line">{issue.coverLine}</div>
      <div className="oe-cover-bar"><span>FREE ISSUE</span></div>
    </div>
  );
}

export { IssueCover as OpenEditionCover };

/** File name readers get when they download the print edition. */
function pdfName(issue: OpenEditionIssue) {
  return issue.pdf.split("/").pop() ?? "open-edition.pdf";
}

export function OpenEditionDownload({ issue, className = "" }: { issue: OpenEditionIssue; className?: string }) {
  return (
    <a
      href={issue.pdf}
      download={pdfName(issue)}
      className={`inline-flex items-center gap-2 rounded-full border border-foreground/20 px-6 py-3 text-sm font-semibold hover:border-foreground/50 ${className}`}
    >
      <Download className="h-4 w-4" /> Download PDF
    </a>
  );
}

function RightsNote({ year }: { year: number }) {
  return (
    <p className="border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
      <span className="font-semibold text-foreground">{openEditionCopyright(year)}</span>{" "}
      This article is not published under a Creative Commons licence. You may link to it and quote brief extracts with credit; any other reproduction needs our written permission.
    </p>
  );
}

function KindTag({ piece }: { piece: OpenEditionPiece }) {
  return piece.kind === "original" ? (
    <span className="rounded-full border border-primary/40 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-primary">Original</span>
  ) : (
    <span className="rounded-full border border-emerald-600/40 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Reprint</span>
  );
}

function StandardsSection({ id = "standards" }: { id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t-2 border-foreground/90 pt-8">
      <p className="eyebrow">Editorial standards</p>
      <h2 id={`${id}-h`} className="mt-2 max-w-3xl text-balance font-display text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl">
        How we research, verify and use AI responsibly
      </h2>
      <p className="oe-serif mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        {`Open Edition combines original reporting by the ${OPEN_EDITION_BYLINE} with openly licensed reprints. These standards apply to every original article. They follow the principles set out by the Committee on Publication Ethics (COPE), the World Association of Medical Editors (WAME) and the STM association’s guidelines on generative AI.`}
      </p>
      <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {OPEN_EDITION_PRINCIPLES.map((p, i) => (
          <div key={p.title} className="border-t border-foreground/15 pt-4">
            <p className="font-mono text-xs tabular-nums text-[var(--gold-600)]">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-1 font-display text-xl font-semibold">{p.title}</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">{p.body}</p>
            <p className="mt-3 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-[var(--gold-600)]">Basis: {p.basis}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-sm text-muted-foreground">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em]">Guidance we follow</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {OPEN_EDITION_GUIDANCE.map((g) => (
            <li key={g.url}>
              <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{g.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Disclosure() {
  const rows: [string, string][] = [
    ["Research", "Our editors directed AI-assisted literature mapping to identify and retrieve the official and peer-reviewed sources cited above, and to prepare a first draft."],
    ["Verification", "Every statistic, quotation and citation was checked against its source and logged claim by claim in the verification log below. Any figure we could not confirm at its original source is labelled as such in the text."],
    ["Data visualization", "Charts are drawn to scale by Eleventh Press from the cited figures, with the source under each one. No AI-generated images are used."],
    ["Accountability", `The ${OPEN_EDITION_BYLINE} reviewed, edited and approved this article and is fully responsible for its content. AI tools are not credited as authors.`],
  ];
  return (
    <aside aria-label="How this article was made" className="rounded-b-xl border border-t-[3px] border-border border-t-primary bg-card/60 p-5 sm:p-6">
      <p className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-primary">
        <ShieldCheck className="h-3.5 w-3.5" /> How this article was made
      </p>
      <dl className="mt-4 grid gap-x-5 gap-y-3 text-[0.92rem] leading-relaxed sm:grid-cols-[9rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-semibold text-foreground">{k}</dt>
            <dd className="mb-2 text-muted-foreground sm:mb-0">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
        Our practice follows the principles of <abbr title="Committee on Publication Ethics" className="font-semibold text-foreground no-underline">COPE</abbr>,{" "}
        <abbr title="World Association of Medical Editors" className="font-semibold text-foreground no-underline">WAME</abbr> and the STM guidelines on generative AI.{" "}
        <a href="#standards" className="text-primary underline underline-offset-2">Read our editorial standards</a>.
      </p>
    </aside>
  );
}

function VerificationLog({ piece }: { piece: OpenEditionPiece }) {
  const [open, setOpen] = useState(false);
  const rows = piece.verification ?? [];
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold"
      >
        <span>Verification log · {rows.length} claims checked</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-[0.84rem]">
            <thead>
              <tr className="border-b border-border font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="w-[38%] py-2 pr-3 font-medium">Claim</th>
                <th className="w-[18%] py-2 pr-3 font-medium">Source</th>
                <th className="w-[20%] py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.claim} className="border-b border-border/70 align-top">
                  <td className="py-2.5 pr-3">{r.claim}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{r.source}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[0.64rem] ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="py-2.5 text-muted-foreground">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PieceReader({
  issue, piece, index, onOpen, onBack,
}: {
  issue: OpenEditionIssue; piece: OpenEditionPiece; index: number; onOpen: (slug: string) => void; onBack: () => void;
}) {
  const prev = issue.pieces[index - 1];
  const next = issue.pieces[index + 1];
  const minutes = readingMinutes(piece.bodyHtml);
  const credit = piece.reprint;

  return (
    <article className="page-enter pb-20">
      {/* Running head */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-b border-foreground/10 px-4 py-4 sm:px-6 lg:px-8">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Contents
        </button>
        <p className="truncate font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
          {issue.series} · Vol. {issue.volume}, No. {issue.issueNumber} · {String(index + 1).padStart(2, "0")} of {String(issue.pieces.length).padStart(2, "0")}
        </p>
      </div>

      {/* Headline block */}
      <header className="mx-auto max-w-4xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[var(--gold-600)]">{piece.section}</p>
          <KindTag piece={piece} />
        </div>
        <h1 className="mt-4 text-balance font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.025em] sm:text-6xl">{piece.title}</h1>
        <p className="oe-serif mt-5 max-w-3xl text-pretty text-xl font-light leading-[1.45] text-foreground/80 sm:text-[1.45rem]">{piece.dek}</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-foreground/10 py-3 text-sm">
          <span>
            By <span className="font-semibold">{credit ? credit.authors || credit.publisher : OPEN_EDITION_BYLINE}</span>
          </span>
          {credit && <span className="text-muted-foreground">Republished from <i>{credit.publication}</i></span>}
          <span className="text-muted-foreground">{issueDate(issue.publishedAt)}</span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {minutes} min read</span>
          {piece.dataNote && <span className="text-muted-foreground">{piece.dataNote}</span>}
        </div>
      </header>

      {/* Hero image, wider than the text measure */}
      <figure className="mx-auto mt-10 max-w-6xl px-4 sm:px-6 lg:px-8">
        <img src={piece.image} alt={piece.imageAlt} className="aspect-[16/9] w-full rounded-sm bg-muted object-cover sm:aspect-[21/9]" />
        <figcaption className="mt-2 text-right font-mono text-[0.68rem] text-muted-foreground">{piece.imageCredit}</figcaption>
      </figure>

      <div className="mx-auto mt-10 max-w-4xl px-4 sm:px-6 lg:px-8">
        {credit && (
          <div className="mx-auto mb-10 max-w-[var(--oe-measure)] rounded-lg border border-emerald-600/30 bg-emerald-600/[0.05] p-5 text-[0.92rem] leading-relaxed">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Republished under an open licence</p>
            <p className="mt-2">
              From{" "}
              <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
                <i>{credit.publication}</i>
              </a>
              , published by {credit.publisher}. Licensed under{" "}
              <a href={credit.licence.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{credit.licence.label}</a>.{" "}
              {credit.notes}
            </p>
            <p className="mt-2 text-muted-foreground">Eleventh Press is not affiliated with, sponsored by or endorsed by {credit.publisher}.</p>
          </div>
        )}

        <div
          className={`oe-prose ${piece.kind === "original" ? "oe-dropcap" : ""}`}
          dangerouslySetInnerHTML={{ __html: piece.bodyHtml }}
        />

        {piece.kind === "original" && piece.sources && (
          <div className="mx-auto mt-12 max-w-[var(--oe-measure)] space-y-8">
            <section aria-labelledby={`${piece.slug}-sources`} className="border-t-2 border-foreground/90 pt-4">
              <h2 id={`${piece.slug}-sources`} className="font-mono text-[0.7rem] uppercase tracking-[0.18em]">Sources</h2>
              <ol className="oe-sources mt-3 list-decimal pl-5">
                {piece.sources.map((s, i) => (
                  <li key={i} id={`${piece.refPrefix}-s${i + 1}`} dangerouslySetInnerHTML={{ __html: s }} />
                ))}
              </ol>
            </section>
            <Disclosure />
            <VerificationLog piece={piece} />
            <RightsNote year={issue.year} />
          </div>
        )}

        {/* Previous / next */}
        <nav aria-label="More in this issue" className="mx-auto mt-16 grid max-w-[var(--oe-measure)] gap-4 border-t border-foreground/10 pt-6 sm:grid-cols-2">
          {prev ? (
            <button onClick={() => onOpen(prev.slug)} className="group text-left">
              <span className="inline-flex items-center gap-1 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground"><ArrowLeft className="h-3 w-3" /> Previous</span>
              <span className="mt-1 block font-display text-lg font-semibold leading-snug group-hover:text-primary">{prev.title}</span>
            </button>
          ) : <span />}
          {next ? (
            <button onClick={() => onOpen(next.slug)} className="group text-left sm:text-right">
              <span className="inline-flex items-center gap-1 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">Next <ArrowRight className="h-3 w-3" /></span>
              <span className="mt-1 block font-display text-lg font-semibold leading-snug group-hover:text-primary">{next.title}</span>
            </button>
          ) : (
            <button onClick={onBack} className="group text-left sm:text-right">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">End of issue</span>
              <span className="mt-1 block font-display text-lg font-semibold leading-snug group-hover:text-primary">Back to contents</span>
            </button>
          )}
        </nav>
      </div>

      {piece.kind === "original" && (
        <div className="mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
          <StandardsSection />
        </div>
      )}
    </article>
  );
}

function ContentsEntry({ piece, n, onOpen }: { piece: OpenEditionPiece; n: number; onOpen: (slug: string) => void }) {
  return (
    <li>
      <button
        onClick={() => onOpen(piece.slug)}
        className="group grid w-full grid-cols-[2.5rem_1fr] gap-x-4 gap-y-3 border-b border-foreground/10 py-6 text-left sm:grid-cols-[3rem_1fr_11rem] sm:gap-x-6"
      >
        <span className="font-display text-3xl font-normal leading-none tabular-nums text-[var(--gold-600)]">{String(n).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">{piece.section}</span>
            <KindTag piece={piece} />
          </span>
          <span className="mt-2 block text-balance font-display text-xl font-semibold leading-snug transition-colors group-hover:text-primary sm:text-2xl">{piece.title}</span>
          <span className="oe-serif mt-1.5 block text-pretty text-[1.02rem] leading-relaxed text-muted-foreground">{piece.dek}</span>
          <span className="mt-2 block font-mono text-[0.68rem] text-muted-foreground">
            {piece.reprint ? `From ${piece.reprint.publication}` : `By ${OPEN_EDITION_BYLINE}`} · {readingMinutes(piece.bodyHtml)} min
          </span>
        </span>
        <span className="col-start-2 self-start overflow-hidden rounded-sm bg-muted sm:col-start-3 sm:row-start-1">
          <img src={piece.image} alt="" loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        </span>
      </button>
    </li>
  );
}

function IssueHome({ issue, onOpen }: { issue: OpenEditionIssue; onOpen: (slug: string) => void }) {
  const { setView } = useApp();
  const originals = issue.pieces.filter((p) => p.kind === "original").length;
  const reprints = issue.pieces.length - originals;
  const totalMinutes = issue.pieces.reduce((t, p) => t + readingMinutes(p.bodyHtml), 0);

  return (
    <div className="page-enter mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <button onClick={() => setView("magazines")} className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All magazines
      </button>

      {/* Masthead */}
      <header className="mt-6 grid items-center gap-10 border-b-2 border-foreground/90 pb-12 md:grid-cols-[minmax(0,300px)_1fr] lg:gap-16">
        <IssueCover issue={issue} className="mx-auto w-full max-w-[300px]" />
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[var(--gold-600)]">
            {issue.series} · Vol. {issue.volume}, No. {issue.issueNumber} · {issueDate(issue.publishedAt)}
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[0.98] tracking-[-0.03em] sm:text-7xl">
            {issue.title} <span className="font-normal italic text-primary">{issue.titleItalic}</span>
          </h1>
          <p className="oe-serif mt-5 max-w-xl text-pretty text-xl leading-relaxed text-foreground/80">{issue.description}</p>
          <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground">Features</dt><dd className="font-display text-2xl font-semibold tabular-nums">{originals}</dd></div>
            <div><dt className="text-muted-foreground">Licensed reprints</dt><dd className="font-display text-2xl font-semibold tabular-nums">{reprints}</dd></div>
            <div><dt className="text-muted-foreground">Reading time</dt><dd className="font-display text-2xl font-semibold tabular-nums">{totalMinutes} min</dd></div>
            <div><dt className="text-muted-foreground">Price</dt><dd className="font-display text-2xl font-semibold">Free</dd></div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => onOpen(issue.pieces[0].slug)} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
              <BookOpen className="h-4 w-4" /> Start reading
            </button>
            <a href="#contents" className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-6 py-3 text-sm font-semibold hover:border-foreground/50">
              Contents
            </a>
            <OpenEditionDownload issue={issue} />
          </div>
        </div>
      </header>

      {/* Editor's note + contents */}
      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <section aria-labelledby="oe-note-h" className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">From the editors</p>
          <h2 id="oe-note-h" className="mt-2 font-display text-3xl font-bold tracking-tight">Welcome to Open Edition</h2>
          <div className="oe-note mt-5">
            {issue.editorsNote.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="mt-2 font-display text-lg italic text-muted-foreground">The Editors</p>
        </section>

        <section id="contents" aria-labelledby="oe-contents-h" className="scroll-mt-24">
          <div className="flex items-baseline justify-between border-b-2 border-foreground/90 pb-3">
            <h2 id="oe-contents-h" className="font-display text-3xl font-bold tracking-tight">Contents</h2>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">{issue.pieces.length} pieces</p>
          </div>
          <ol>
            {issue.pieces.map((p, i) => <ContentsEntry key={p.slug} piece={p} n={i + 1} onOpen={onOpen} />)}
          </ol>
        </section>
      </div>

      <div className="mt-20">
        <StandardsSection />
      </div>

      <footer className="mt-14 space-y-3 border-t border-foreground/10 pt-6 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">{openEditionCopyright(issue.year)}</span> {OPEN_EDITION_RIGHTS_DETAIL}
        </p>
        <p>
          Cover and article photographs: Unsplash, under the Unsplash Licence. Charts and illustrations are drawn by Eleventh Press from the cited data.
          Reprints keep their original Creative Commons licences, shown on each article. Publication names identify the source of each reprint; Eleventh
          Press is not affiliated with, sponsored by or endorsed by those publishers.
        </p>
      </footer>
    </div>
  );
}

export function OpenEditionIssueView({ issue }: { issue: OpenEditionIssue }) {
  const [slug, setSlug] = useState<string | null>(null);

  // Open the piece named in the URL hash on load, and follow Back/Forward.
  useEffect(() => {
    // Only a piece slug (or no hash) changes the page: in-page anchors such
    // as #contents, #standards or a source note (#a1-s1) must not.
    const sync = () => {
      if (!window.location.hash) setSlug(null);
      else {
        const found = pieceFromHash(issue);
        if (found) setSlug(found);
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [issue]);

  const index = useMemo(() => issue.pieces.findIndex((p) => p.slug === slug), [issue, slug]);
  const piece = index >= 0 ? issue.pieces[index] : null;

  useEffect(() => {
    const base = "Eleventh Press";
    document.title = piece
      ? `${piece.title} — ${issue.series} — ${base}`
      : `${issue.series}: ${issue.title} ${issue.titleItalic} — Magazines — ${base}`;
  }, [issue, piece]);

  const open = useCallback((next: string) => {
    window.history.pushState(null, "", `${window.location.pathname}#${encodeURIComponent(next)}`);
    setSlug(next);
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => {
    window.history.pushState(null, "", window.location.pathname);
    setSlug(null);
    requestAnimationFrame(() => document.getElementById("contents")?.scrollIntoView({ block: "start" }));
  }, []);

  return (
    <div className={`oe ${editorialSerif.variable}`}>
      {piece ? (
        <PieceReader key={piece.slug} issue={issue} piece={piece} index={index} onOpen={open} onBack={back} />
      ) : (
        <IssueHome issue={issue} onOpen={open} />
      )}
    </div>
  );
}
