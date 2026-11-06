import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck2, ExternalLink, FileDown, FileText, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { APP_BASE_URL, ARTICLE_LANGUAGE, JOURNAL_IDENTITY } from "@/lib/site";
import { GUIDES } from "@/lib/resources-content";
import { fmtLongDate, getGuideDoc, guideById, guideCitation, guidePath, guidePdfPath } from "@/lib/resources";
import { ResourcePageShell, BackToResources } from "@/components/resources/resource-page-shell";
import { FaqBlock, NumberedList, OnThisPage, SectionBlock, slugifyHeading } from "@/components/resources/content-blocks";
import { Button } from "@/components/ui/button";

/**
 * GET /resources/guides/[slug] — the online edition of an official
 * Eleventh Press guide. Server-rendered (crawlable, with TechArticle,
 * FAQPage and BreadcrumbList JSON-LD) from the same GuideDoc as the branded
 * PDF edition at ./pdf, so the two never disagree.
 */

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuideDoc(slug);
  if (!g) return { title: "Guide not found" };
  const url = `${APP_BASE_URL}${guidePath(g)}`;
  return {
    title: `${g.title} (${g.code}) | ${JOURNAL_IDENTITY.name}`,
    description: g.metaDescription,
    keywords: [...g.keywords, ...g.benchmarks],
    authors: [{ name: `Editorial Office, ${JOURNAL_IDENTITY.name}` }],
    alternates: { canonical: url, types: { "application/pdf": `${APP_BASE_URL}${guidePdfPath(g)}` } },
    openGraph: {
      title: `${g.title} — Official guide`,
      description: g.metaDescription,
      url,
      type: "article",
      siteName: JOURNAL_IDENTITY.name,
      modifiedTime: g.effective,
      tags: g.keywords,
    },
    twitter: { card: "summary_large_image", title: g.title, description: g.metaDescription },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuideDoc(slug);
  if (!g) notFound();

  const url = `${APP_BASE_URL}${guidePath(g)}`;
  const pdfUrl = `${APP_BASE_URL}${guidePdfPath(g)}`;
  const org = {
    "@type": "Organization",
    name: JOURNAL_IDENTITY.name,
    url: APP_BASE_URL,
    logo: { "@type": "ImageObject", url: `${APP_BASE_URL}/logo.svg` },
    email: JOURNAL_IDENTITY.editorialEmail,
    address: { "@type": "PostalAddress", addressLocality: "London", addressCountry: "GB" },
  };
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: g.title,
      alternativeHeadline: `${g.code}, Version ${g.version}`,
      description: g.metaDescription,
      abstract: g.purpose,
      url,
      mainEntityOfPage: url,
      identifier: g.code,
      version: g.version,
      dateModified: g.effective,
      datePublished: g.effective,
      inLanguage: ARTICLE_LANGUAGE,
      audience: { "@type": "Audience", audienceType: g.audience },
      keywords: [...g.keywords, ...g.benchmarks].join(", "),
      isAccessibleForFree: true,
      license: JOURNAL_IDENTITY.licenseUrl,
      author: org,
      publisher: { ...org, issn: JOURNAL_IDENTITY.issn },
      encoding: { "@type": "MediaObject", encodingFormat: "application/pdf", contentUrl: pdfUrl, name: `${g.title} (PDF)` },
      citation: g.standards.map((s) => ({
        "@type": "CreativeWork",
        name: s.name,
        version: s.edition,
        url: s.url,
        publisher: { "@type": "Organization", name: s.issuer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: g.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: JOURNAL_IDENTITY.shortName, item: APP_BASE_URL },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${APP_BASE_URL}/` },
        { "@type": "ListItem", position: 3, name: g.title, item: url },
      ],
    },
  ];

  const toc = [
    { id: "purpose", label: "Purpose and scope" },
    { id: "key-requirements", label: "Ten key requirements" },
    { id: "standards", label: "Benchmarked standards" },
    ...g.sections.map((s, i) => ({ id: slugifyHeading(s.heading), label: `${i + 1}. ${s.heading}` })),
    { id: "checklist", label: "Compliance checklist" },
    { id: "faq", label: "Frequently asked questions" },
  ];
  const related = g.relatedGuides.map(guideById).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <ResourcePageShell tab="guides">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <BackToResources tab="guides" label="Resources · Guides" />

        {/* Masthead */}
        <header className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a1458] to-[#4c1d95] p-6 text-white shadow-lg sm:p-9">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-[#c9a55c]/25" />
          <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-full border border-[#c9a55c]/25" />
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#e2c785]">{JOURNAL_IDENTITY.name}</p>
          <p className="mt-4 inline-flex rounded border border-[#c9a55c]/70 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-[#e2c785]">
            Official guide · {g.code}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-[2.6rem]">{g.title}</h1>
          <p className="mt-3 max-w-2xl text-[0.97rem] leading-relaxed text-white/80">{g.summary}</p>

          <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            {[
              ["Version", g.version],
              ["Effective", fmtLongDate(g.effective)],
              ["Next review", fmtLongDate(g.nextReview)],
              ["Licence", JOURNAL_IDENTITY.license],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.62rem] font-bold uppercase tracking-wider text-[#e2c785]">{k}</dt>
                <dd className="mt-0.5 text-white/90">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button asChild className="bg-[#c9a55c] text-[#2a1458] hover:bg-[#d8b878]">
              <a href={guidePdfPath(g)} download>
                <FileDown className="mr-2 h-4 w-4" /> Download official PDF
              </a>
            </Button>
            <Button asChild variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <a href={`${guidePdfPath(g)}?inline=1`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open PDF in browser
              </a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-white/60">
            ISSN {JOURNAL_IDENTITY.issn} · Publisher DOI prefix {JOURNAL_IDENTITY.doiPrefix} · {JOURNAL_IDENTITY.location} · {JOURNAL_IDENTITY.editorialEmail}
          </p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0 max-w-3xl space-y-12">
            <section id="purpose" className="scroll-mt-24 grid gap-3 sm:grid-cols-3">
              {[
                ["Purpose", g.purpose],
                ["Scope", g.scope],
                ["Audience", g.audience],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border p-4">
                  <p className="eyebrow">{k}</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85">{v}</p>
                </div>
              ))}
            </section>

            <section id="key-requirements" className="scroll-mt-24 rounded-xl border border-border bg-[var(--royal-50)]/60 p-5 dark:bg-white/[0.03] sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <Sparkles className="h-5 w-5 text-primary" /> At a glance: ten key requirements
              </h2>
              <div className="mt-4">
                <NumberedList items={g.keyPoints} label="Ten key requirements" />
              </div>
            </section>

            <section id="standards" className="scroll-mt-24">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" /> Benchmarked standards and basis
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This guide is benchmarked against the external standards below. “Aligned with” describes the standard each
                requirement follows; it is not a claim of membership in, or certification by, the issuing body.
              </p>
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Standards this guide is benchmarked against</caption>
                  <thead className="hidden bg-primary text-[0.68rem] uppercase tracking-wider text-primary-foreground md:table-header-group">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Standard and issuing body</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Edition</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">How this guide applies it</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.standards.map((s) => (
                      <tr key={s.name} className="block p-4 odd:bg-muted/30 md:table-row md:p-0">
                        <th scope="row" className="block align-top font-normal md:table-cell md:w-[36%] md:px-4 md:py-3">
                          <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-foreground hover:text-primary hover:underline">
                            {s.name}
                          </a>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{s.issuer}</span>
                        </th>
                        <td className="mt-1.5 block align-top text-xs text-muted-foreground md:table-cell md:w-[20%] md:px-4 md:py-3 md:text-sm md:text-foreground/80">
                          <span className="font-semibold md:hidden">Edition: </span>
                          {s.edition}
                        </td>
                        <td className="mt-1.5 block align-top leading-relaxed text-foreground/85 md:table-cell md:px-4 md:py-3">{s.application}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {g.sections.map((s, i) => (
              <SectionBlock key={s.heading} section={s} number={i + 1} />
            ))}

            <section id="checklist" className="scroll-mt-24">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <ListChecks className="h-5 w-5 text-primary" /> Compliance checklist
              </h2>
              <ul className="mt-4 space-y-2.5">
                {g.checklist.map((c, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer gap-3 rounded-md p-1.5 text-[0.97rem] leading-relaxed hover:bg-muted/40">
                      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--royal-600)]" />
                      <span className="min-w-0">{c}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <FaqBlock faqs={g.faqs} />

            <section aria-labelledby="cite" className="space-y-6 border-t border-border pt-8">
              <div>
                <h2 id="cite" className="font-display text-xl font-semibold">How to cite this guide</h2>
                <p className="mt-3 border-l-[3px] border-[var(--gold-500)] bg-muted/30 p-4 text-sm leading-relaxed break-words">{guideCitation(g)}</p>
              </div>
              {related.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-semibold">Related guides</h2>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {related.map((r) => (
                      <li key={r.id} className="paper-card rounded-lg border border-border p-4">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{r.code}</p>
                        <Link href={guidePath(r)} className="mt-1 block font-display text-sm font-semibold hover:text-primary">
                          {r.title}
                        </Link>
                        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <Link href={guidePath(r)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                            <FileText className="h-3 w-3" /> Read online
                          </Link>
                          <a href={guidePdfPath(r)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                            <FileDown className="h-3 w-3" /> PDF
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <CalendarCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This online edition is authoritative and is updated whenever the guide is revised; the PDF is its printable
                edition. Questions about this guide: {JOURNAL_IDENTITY.editorialEmail}.
              </p>
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <OnThisPage items={toc} />
              <a
                href={guidePdfPath(g)}
                download
                className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm font-medium text-primary hover:border-primary/40"
              >
                <FileDown className="h-4 w-4" /> Download PDF ({g.code})
              </a>
            </div>
          </aside>
        </div>
      </article>
    </ResourcePageShell>
  );
}
