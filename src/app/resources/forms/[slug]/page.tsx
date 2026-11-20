import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck2, ExternalLink, FileDown, FileText, ListOrdered, ShieldCheck, Route, MonitorCheck } from "lucide-react";
import { ARTICLE_LANGUAGE, JOURNAL_IDENTITY } from "@/lib/site";
import { getCurrentTenant } from "@/lib/tenant";
import { brandCode, brandContactLine } from "@/lib/resources/tenant-brand";
import { resourceBrandFor } from "@/lib/resources/tenant-brand-server";
import { searchDescription, searchTitle } from "@/lib/seo-text";
import { fmtLongDate, guideById, guidePath } from "@/lib/resources";
import { PublicFormSubmit } from "@/components/forms/public-form-submit";
import { FORM_ROLE_LABEL, formCitation, formPath, formPdfPath, formPlatformPath, getFormDoc } from "@/lib/forms";
import { ResourcePageShell, BackToResources } from "@/components/resources/resource-page-shell";
import { FaqBlock, NumberedList, OnThisPage } from "@/components/resources/content-blocks";
import { OfficialFormFields, FormSignature } from "@/components/forms/official-form-fields";
import { Button } from "@/components/ui/button";

/**
 * GET /resources/forms/[slug] — the online edition of an Official Form:
 * what it is for, when and where it is completed, a read-only preview of
 * every question, and the fillable, branded PDF. Server-rendered and
 * crawlable, from the same definition the platform and the PDF use.
 */
export const dynamic = "force-dynamic";

async function brandForRequest() {
  return resourceBrandFor(await getCurrentTenant().catch(() => null));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await brandForRequest();
  const f = getFormDoc(slug, brand);
  if (!f) return { title: "Form not found" };
  const url = `${brand.baseUrl}${formPath(f)}`;
  return {
    title: searchTitle(`${f.title} (${f.code})`, [brand.publisher, brand.shortName]),
    description: searchDescription(f.metaDescription),
    keywords: [...f.keywords, ...f.benchmarks],
    alternates: { canonical: url, types: { "application/pdf": `${brand.baseUrl}${formPdfPath(f)}` } },
    openGraph: { title: `${f.title} — Official form`, description: f.metaDescription, url, type: "article", siteName: brand.publisher, modifiedTime: f.effective },
    twitter: { card: "summary_large_image", title: f.title, description: f.metaDescription },
  };
}

export default async function FormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await brandForRequest();
  const f = getFormDoc(slug, brand);
  if (!f) notFound();

  const url = `${brand.baseUrl}${formPath(f)}`;
  const pdfUrl = `${brand.baseUrl}${formPdfPath(f)}`;
  const org = { "@type": "Organization", name: brand.publisher, url: brand.baseUrl, logo: { "@type": "ImageObject", url: brand.logoUrl } };
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "DigitalDocument",
      name: f.title,
      alternateName: `${f.code}, Version ${f.version}`,
      description: f.metaDescription,
      abstract: f.purpose,
      url,
      identifier: f.code,
      version: f.version,
      dateModified: f.effective,
      datePublished: f.effective,
      inLanguage: ARTICLE_LANGUAGE,
      audience: { "@type": "Audience", audienceType: f.audience },
      keywords: [...f.keywords, ...f.benchmarks].join(", "),
      isAccessibleForFree: true,
      license: JOURNAL_IDENTITY.licenseUrl,
      author: org,
      publisher: { ...org, ...(brand.issn ? { issn: brand.issn } : {}) },
      encoding: { "@type": "MediaObject", encodingFormat: "application/pdf", contentUrl: pdfUrl, name: `${f.title} (fillable PDF)` },
      citation: f.standards.map((s) => ({ "@type": "CreativeWork", name: s.name, version: s.edition, url: s.url, publisher: { "@type": "Organization", name: s.issuer } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: f.faqs.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: brand.shortName, item: brand.baseUrl },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${brand.baseUrl}/resources?tab=forms` },
        { "@type": "ListItem", position: 3, name: f.title, item: url },
      ],
    },
  ];

  const toc = [
    { id: "about", label: "About this form" },
    { id: "instructions", label: "Instructions" },
    { id: "the-form", label: "The form" },
    { id: "next", label: "What happens next" },
    { id: "standards", label: "Benchmarked standards" },
    { id: "faq", label: "Frequently asked questions" },
  ];
  const related = f.relatedGuides.map(guideById).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <ResourcePageShell tab="forms">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <BackToResources tab="forms" label="Resources · Forms" />

        <header
          className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a1458] to-[#4c1d95] p-6 text-white shadow-lg sm:p-9"
          style={brand.whitelabel ? { backgroundImage: `linear-gradient(to bottom right, color-mix(in srgb, ${brand.primaryHex} 62%, black), ${brand.primaryHex})` } : undefined}
        >
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-[#c9a55c]/25" />
          <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-full border border-[#c9a55c]/25" />
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#e2c785]">{brand.publisher}</p>
          <p className="mt-4 inline-flex rounded border border-[#c9a55c]/70 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-[#e2c785]">
            Official form · {f.code} · {FORM_ROLE_LABEL[f.role]}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-[2.6rem]">{f.title}</h1>
          <p className="mt-3 max-w-2xl text-[0.97rem] leading-relaxed text-white/80">{f.summary}</p>

          <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            {[
              ["Version", f.version],
              ["Effective", fmtLongDate(f.effective)],
              ["Next review", fmtLongDate(f.nextReview)],
              ["Completed by", FORM_ROLE_LABEL[f.role]],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.62rem] font-bold uppercase tracking-wider text-[#e2c785]">{k}</dt>
                <dd className="mt-0.5 text-white/90">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {f.scope !== "offline" && (
              <Button asChild className="bg-[#c9a55c] text-[#2a1458] hover:bg-[#d8b878]">
                <a href={formPlatformPath(f)}>
                  <MonitorCheck className="mr-2 h-4 w-4" /> {f.scope === "public" ? "Submit this form online" : "Complete on the platform"}
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <a href={formPdfPath(f)} download>
                <FileDown className="mr-2 h-4 w-4" /> Download fillable PDF
              </a>
            </Button>
            <Button asChild variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <a href={`${formPdfPath(f)}?inline=1`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open PDF in browser
              </a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-white/60">{brandContactLine(brand)}</p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0 max-w-3xl space-y-12">
            <section id="about" className="scroll-mt-24 grid gap-3 sm:grid-cols-3">
              {[
                ["Purpose", f.purpose],
                ["When", f.when],
                ["Where on the platform", f.where],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border p-4">
                  <p className="eyebrow">{k}</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85">{v}</p>
                </div>
              ))}
            </section>

            <section id="instructions" className="scroll-mt-24 rounded-xl border border-border bg-[var(--royal-50)]/60 p-5 dark:bg-white/[0.03] sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <ListOrdered className="h-5 w-5 text-primary" /> Instructions
              </h2>
              <div className="mt-4">
                <NumberedList items={f.instructions} label="Instructions" />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {f.scope === "offline"
                  ? "This form is completed on the fillable PDF and signed by hand or electronically by the person concerned. The authors keep the signed copy; it is not uploaded with the manuscript. The PDF is fillable in Adobe Acrobat Reader, Apple Preview and modern browsers."
                  : f.scope === "public"
                    ? "Submitting the form online below is the quickest route: your answers are checked and sent straight to the editors, and you receive a reference number. You can also email the completed PDF to the editorial office."
                    : "Completing the form on the platform is the official route: your answers are checked, signed and stored with the manuscript, and you can download a signed copy at any time. The PDF is fillable in Adobe Acrobat Reader, Apple Preview and modern browsers, and can also be printed and signed by hand."}
              </p>
            </section>

            <section id="the-form" className="scroll-mt-24">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <FileText className="h-5 w-5 text-primary" /> The form
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A preview of every question. Questions marked * are required when they apply; on the platform, a question
                appears only when it applies to you.
              </p>
              <div className="paper-card mt-5 rounded-xl border border-border p-5 sm:p-7">
                <OfficialFormFields doc={f} answers={{}} mode="preview" />
                <div className="mt-8">
                  <FormSignature doc={f} value="" preview />
                </div>
              </div>
            </section>

            {f.scope === "public" && (
              <section id="submit" className="scroll-mt-24">
                <PublicFormSubmit formId={f.id} />
              </section>
            )}

            <section id="next" className="scroll-mt-24">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <Route className="h-5 w-5 text-primary" /> What happens next
              </h2>
              <ul className="mt-4 space-y-2.5">
                {f.afterSubmission.map((a) => (
                  <li key={a} className="flex gap-3 text-[0.97rem] leading-relaxed">
                    <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-[var(--gold-500)]" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="standards" className="scroll-mt-24">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" /> Benchmarked standards and basis
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This form is benchmarked against the external standards below. “Aligned with” describes the standard each
                question follows; it is not a claim of membership in, or certification by, the issuing body.
              </p>
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Standards this form is benchmarked against</caption>
                  <thead className="hidden bg-primary text-[0.68rem] uppercase tracking-wider text-primary-foreground md:table-header-group">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Standard and issuing body</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Edition</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">How this form applies it</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {f.standards.map((s) => (
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

            <FaqBlock faqs={f.faqs} />

            <section aria-labelledby="cite" className="space-y-6 border-t border-border pt-8">
              <div>
                <h2 id="cite" className="font-display text-xl font-semibold">How to cite this form</h2>
                <p className="mt-3 border-l-[3px] border-[var(--gold-500)] bg-muted/30 p-4 text-sm leading-relaxed break-words">{formCitation(f, brand)}</p>
              </div>
              {related.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-semibold">Related guides</h2>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {related.map((r) => (
                      <li key={r.id} className="paper-card rounded-lg border border-border p-4">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{brandCode(r.code, brand)}</p>
                        <Link href={guidePath(r)} className="mt-1 block font-display text-sm font-semibold hover:text-primary">
                          {r.title}
                        </Link>
                        <Link href={guidePath(r)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          Read the guide <ArrowRight className="h-3 w-3" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <CalendarCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This online edition is authoritative and is updated whenever the form is revised; the PDF is its fillable,
                printable edition.{brand.email ? ` Questions about this form: ${brand.email}.` : ""}
              </p>
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <OnThisPage items={toc} />
              <a href={formPdfPath(f)} download className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm font-medium text-primary hover:border-primary/40">
                <FileDown className="h-4 w-4" /> Fillable PDF ({f.code})
              </a>
            </div>
          </aside>
        </div>
      </article>
    </ResourcePageShell>
  );
}
