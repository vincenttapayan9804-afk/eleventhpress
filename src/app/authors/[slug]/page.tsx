import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  ExternalLink,
  Eye,
  FileBadge2,
  FileJson,
  Fingerprint,
  Github,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  Quote,
  ShieldCheck,
  Twitter,
  Users,
} from "lucide-react";
import { resolveTenantFromHeaders, tenantBaseUrl } from "@/lib/tenant";
import { getAuthorProfile, IDENTITY_LABEL, type AuthorProfile } from "@/lib/author-profile";
import { displayCase } from "@/lib/author-path";
import { searchDescription, searchTitle } from "@/lib/seo-text";
import { articlePath } from "@/lib/spa-routes";
import { AuthorProfileShell } from "@/components/authors/author-profile-shell";
import { FollowAuthorButton } from "@/components/authors/follow-author-button";
import { ProfileSharePanel, ShareProfileButton } from "@/components/authors/profile-share";
import { AlertMeButton } from "@/components/alert-me-button";

/**
 * GET /authors/[slug] — the public, shareable and verifiable profile of
 * every author with a published article (src/lib/author-profile.ts). Built
 * on request from the published record, so it exists for every current and
 * future author without anyone setting it up, and it always matches what
 * is published. Carries ProfilePage/Person/ScholarlyArticle JSON-LD, a QR
 * code, and a machine-readable record at /api/authors/<slug>.
 */
export const dynamic = "force-dynamic";

const load = cache(async (slug: string) => {
  const tenant = await resolveTenantFromHeaders(await headers()).catch(() => null);
  const [profile, base] = await Promise.all([getAuthorProfile(slug, tenant?.id ?? null), tenantBaseUrl(tenant?.id ?? null)]);
  const site = tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : "Eleventh Press International Publishing™";
  return { profile, base, site };
});

const profileUrl = (base: string, p: AuthorProfile) => `${base}/authors/${encodeURIComponent(p.slug)}`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { profile: p, base, site } = await load(slug);
  if (!p) return { title: "Author not found", robots: { index: false } };
  const name = displayCase(p.name);
  const role = [displayCase(p.profession), p.affiliation].filter(Boolean).join(", ");
  const description =
    p.bio?.trim() && p.bio.trim().length > 40
      ? p.bio.trim().slice(0, 200)
      : `${name}${role ? `, ${role}` : ""}. ${p.articles.length} publication${p.articles.length === 1 ? "" : "s"} in ${p.disciplines.join(", ")} with ${site}, each verifiable.`;
  const url = profileUrl(base, p);
  return {
    title: searchTitle(`${name} — Author profile`),
    description: searchDescription(description),
    alternates: { canonical: url },
    openGraph: { title: `${name} — Author profile`, description, url, type: "profile", siteName: site },
    twitter: { card: "summary_large_image", title: `${name} — Author profile`, description },
  };
}

const fmtMonth = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const INTEGRITY: Record<string, { label: string; tone: string }> = {
  CORRECTED: { label: "Correction issued", tone: "border-sky-300/60 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200" },
  UNDER_CONCERN: { label: "Expression of concern", tone: "border-amber-300/70 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" },
  RETRACTED: { label: "Retracted", tone: "border-red-300/70 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200" },
};

const STATUS_LABEL: Record<string, string> = { FACULTY: "Faculty", STUDENT: "Student", STAFF: "Staff" };

function initialsOf(name: string) {
  return name
    .replace(/^(Dr|Prof)\.?\s+/i, "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Check({ ok, title, children }: { ok: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/60" aria-hidden="true" />
      )}
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">
          <span className="sr-only">{ok ? "Confirmed: " : "Not confirmed: "}</span>
          {title}
        </p>
        {children && <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>}
      </div>
    </li>
  );
}

function Panel({ id, title, Icon, children }: { id?: string; title: string; Icon: typeof ShieldCheck; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 id={id ? `${id}-h` : undefined} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AuthorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { profile: p, base, site } = await load(slug);
  if (!p) notFound();

  const url = profileUrl(base, p);
  const name = displayCase(p.name);
  const profession = displayCase(p.profession);
  const identity = IDENTITY_LABEL[p.verification.identity];
  const verified = p.verification.identity === "orcid-authenticated" || p.verification.identity === "verified-account";
  const { checks, certificates } = p.verification;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#24164dff", light: "#ffffffff" } }).catch(() => null);

  const links = [
    p.links.website && { href: p.links.website, label: "Website", Icon: Globe },
    p.links.linkedin && { href: p.links.linkedin, label: "LinkedIn", Icon: Linkedin },
    p.links.twitter && { href: p.links.twitter, label: "X", Icon: Twitter },
    p.links.github && { href: p.links.github, label: "GitHub", Icon: Github },
    p.links.email && { href: `mailto:${p.links.email}`, label: p.links.email, Icon: Mail },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Globe }[];

  const integrityCount = p.articles.filter((a) => a.integrity).length;
  const byYear = new Map<string, AuthorProfile["articles"]>();
  for (const a of p.articles) {
    const y = a.publishedAt ? String(a.publishedAt.getUTCFullYear()) : "Undated";
    byYear.set(y, [...(byYear.get(y) ?? []), a]);
  }

  const metrics = [
    { label: "Publications", value: p.articles.length.toLocaleString(), hint: p.firstYear ? (p.firstYear === p.latestYear ? `${p.firstYear}` : `${p.firstYear}–${p.latestYear}`) : null, Icon: BookOpen },
    {
      label: p.metrics.source === "openalex" ? "Citations · all work" : "Citations",
      value: (p.metrics.citedBy ?? 0).toLocaleString(),
      hint: (p.metrics.citedBy ?? 0) === 0 ? "Not yet cited" : null,
      Icon: Quote,
    },
    { label: "h-index", value: String(p.metrics.hIndex ?? 0), hint: p.metrics.i10Index != null ? `i10-index ${p.metrics.i10Index}` : null, Icon: BadgeCheck },
    { label: "Article views", value: p.totals.views.toLocaleString(), hint: null, Icon: Eye },
    { label: "Downloads", value: p.totals.downloads.toLocaleString(), hint: null, Icon: Download },
  ];

  const sameAs = [p.orcid && `https://orcid.org/${p.orcid}`, p.links.website, p.links.linkedin, p.links.twitter, p.links.github].filter(Boolean) as string[];
  const personId = `${url}#person`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": url,
        url,
        name: `${name} — Author profile`,
        isPartOf: { "@type": "WebSite", name: site, url: base },
        mainEntity: { "@id": personId },
        dateModified: p.verification.checkedAt.toISOString(),
      },
      {
        "@type": "Person",
        "@id": personId,
        name,
        url,
        ...(profession ? { jobTitle: profession } : {}),
        ...(p.affiliation ? { affiliation: { "@type": "Organization", name: p.affiliation } } : {}),
        ...(p.country ? { nationality: { "@type": "Country", name: p.country } } : {}),
        ...(p.orcid ? { identifier: { "@type": "PropertyValue", propertyID: "ORCID", value: p.orcid, url: `https://orcid.org/${p.orcid}` } } : {}),
        ...(sameAs.length ? { sameAs } : {}),
        ...(p.avatarUrl ? { image: p.avatarUrl } : {}),
        ...(p.bio ? { description: p.bio } : {}),
        ...(p.topics.length ? { knowsAbout: p.topics } : {}),
      },
      ...p.articles.slice(0, 50).map((a) => ({
        "@type": "ScholarlyArticle",
        headline: a.title.slice(0, 250),
        url: `${base}${articlePath(a.id, a.title)}`,
        author: { "@id": personId },
        ...(a.publishedAt ? { datePublished: a.publishedAt.toISOString().slice(0, 10) } : {}),
        ...(a.doi ? { sameAs: `https://doi.org/${a.doi}` } : {}),
        ...(a.journal ? { isPartOf: { "@type": "Periodical", name: a.journal } } : {}),
      })),
    ],
  };

  return (
    <AuthorProfileShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Masthead */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-b from-[var(--royal-50)] via-[var(--royal-50)]/50 to-background">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-[var(--royal-200)]/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <a href="/authors" className="font-medium text-primary hover:underline">Authors</a>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="truncate">{name}</li>
            </ol>
          </nav>

          <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative flex-shrink-0 self-start">
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={name} className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-4 ring-background sm:h-36 sm:w-36" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.5_0.18_296)] to-[oklch(0.28_0.13_293)] font-display text-3xl font-semibold text-white shadow-lg sm:text-4xl ring-4 ring-background sm:h-36 sm:w-36">
                  {initialsOf(name)}
                </div>
              )}
              {verified && (
                <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-md" title={identity.detail}>
                  <BadgeCheck className="h-7 w-7 fill-primary text-primary-foreground" aria-hidden="true" />
                  <span className="sr-only">{identity.badge}</span>
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="#verification"
                  className={
                    verified
                      ? "inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                      : "inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  }
                >
                  {verified ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />}
                  {identity.badge}
                </a>
                {p.academicStatus && STATUS_LABEL[p.academicStatus] && (
                  <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">{STATUS_LABEL[p.academicStatus]}</span>
                )}
              </div>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2.6rem]">{name}</h1>
              {profession && <p className="mt-2 text-base font-medium text-foreground/80 sm:text-lg">{profession}</p>}
              <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                {p.affiliation && (
                  <li className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" aria-hidden="true" /> {p.affiliation}
                    {p.department && <span>· {p.department.name}</span>}
                  </li>
                )}
                {p.country && (
                  <li className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" aria-hidden="true" /> {p.country}
                  </li>
                )}
                {p.orcid && (
                  <li>
                    <a href={`https://orcid.org/${p.orcid}`} target="_blank" rel="noopener noreferrer me" className="inline-flex items-center gap-1.5 font-medium text-foreground/80 hover:text-primary">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#a6ce39] text-[0.55rem] font-bold text-white" aria-hidden="true">iD</span>
                      {p.orcid}
                      {p.verification.orcidAuthenticated && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label="authenticated" />}
                    </a>
                  </li>
                )}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {p.accountId && <FollowAuthorButton accountId={p.accountId} initialCount={p.followerCount} />}
                <AlertMeButton kind="AUTHOR" query={p.orcid || p.name} label="Alert me about new work" size="default" />
                <ShareProfileButton url={url} name={name} />
              </div>
            </div>
          </header>

          {/* Key figures */}
          <section aria-label="Key figures" className="mt-8 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card/90 shadow-sm backdrop-blur sm:grid-cols-5">
            {metrics.map(({ label, value, hint, Icon }, i) => (
              <div
                key={label}
                className={`p-4 sm:p-5 ${i > 0 ? "sm:border-l" : ""} ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 4 ? "col-span-2 sm:col-span-1" : ""} border-border`}
              >
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {label}
                </p>
                <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-foreground sm:text-[1.75rem]">{value}</p>
                {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
              </div>
            ))}
          </section>
          <p className="mt-2 text-xs text-muted-foreground">
            {p.metrics.source === "openalex"
              ? "Citations and h-index cover this author's whole scholarly output, from OpenAlex by ORCID iD. Views and downloads count this site only."
              : `Citations and h-index count articles published with ${site} only${p.orcid ? "" : ", as there is no ORCID iD to look up a fuller record"}.`}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="min-w-0 space-y-10">
          {(p.bio || p.topics.length > 0 || p.disciplines.length > 0) && (
            <section aria-labelledby="about-h">
              <h2 id="about-h" className="font-display text-xl font-semibold">About</h2>
              {p.bio && <p className="mt-3 max-w-3xl whitespace-pre-line leading-relaxed text-foreground/90">{p.bio}</p>}
              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Disciplines</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.disciplines.map((d) => (
                      <span key={d} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{d}</span>
                    ))}
                  </dd>
                </div>
                {p.topics.length > 0 && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Research topics</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.topics.map((t) => (
                        <span key={t} className="rounded-full border border-border px-3 py-1 text-xs text-foreground/80">{t}</span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section aria-labelledby="pubs-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="pubs-h" className="font-display text-xl font-semibold">Publications</h2>
              <p className="text-sm text-muted-foreground">
                {p.articles.length} published with {site}
              </p>
            </div>
            <div className="mt-4 space-y-8">
              {[...byYear.entries()].map(([year, list]) => (
                <div key={year}>
                  <h3 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {year} <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  </h3>
                  <ol className="mt-3 space-y-3">
                    {list.map((a) => {
                      const integrity = a.integrity ? INTEGRITY[a.integrity] : null;
                      return (
                        <li key={a.id} className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-md bg-muted px-2 py-0.5 font-semibold text-foreground/80">
                              {a.contentType === "EXPERT_INSIGHT" ? "Expert insight" : "Research article"}
                            </span>
                            <span className="text-muted-foreground">{a.discipline}</span>
                            {integrity && <span className={`rounded-md border px-2 py-0.5 font-semibold ${integrity.tone}`}>{integrity.label}</span>}
                          </div>
                          <a href={articlePath(a.id, a.title)} className="mt-2 block font-display text-[1.05rem] font-semibold leading-snug text-foreground hover:text-primary sm:text-lg">
                            {a.title}
                          </a>
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            {a.authors.map((x, i) => (
                              <span key={i}>
                                {i > 0 && ", "}
                                {x.slug.toUpperCase() === p.slug.toUpperCase() ? (
                                  <strong className="font-semibold text-foreground">{displayCase(x.name)}</strong>
                                ) : (
                                  <a href={`/authors/${encodeURIComponent(x.slug)}`} className="hover:text-primary hover:underline">{displayCase(x.name)}</a>
                                )}
                              </span>
                            ))}
                          </p>
                          <p className="mt-1 text-sm italic text-foreground/70">
                            {[a.journal, a.issue ? `Vol. ${a.issue.volume}, No. ${a.issue.number} (${a.issue.year})` : null, a.publishedAt ? `published ${fmtMonth(a.publishedAt)}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {a.abstract && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground/75">{a.abstract}</p>}
                          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-xs">
                            {a.sealed && (
                              <a href={`/verify/article/${a.id}`} className="inline-flex items-center gap-1 rounded-md border border-emerald-300/60 bg-emerald-50 px-2 py-1 font-medium text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200">
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Provenance sealed
                              </a>
                            )}
                            {a.authorship && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 font-medium text-primary"
                                title={a.creditRoles.length ? `Contribution: ${a.creditRoles.join(", ")}` : undefined}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {a.authorship === "submitting" ? "Submitting author" : "Authorship confirmed"}
                              </span>
                            )}
                            {a.doi && (
                              <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground/80 hover:border-primary/40 hover:text-primary">
                                DOI {a.doi} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            )}
                            <span className="ml-auto tabular-nums text-muted-foreground">
                              {a.citations.toLocaleString()} citation{a.citations === 1 ? "" : "s"} · {a.views.toLocaleString()} views · {a.downloads.toLocaleString()} downloads
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Verification, links and sharing">
          <Panel id="verification" title="Verification" Icon={ShieldCheck}>
            <ul className="divide-y divide-border/70">
              <Check ok={verified} title={identity.badge}>
                {identity.detail}
              </Check>
              <Check
                ok={p.verification.orcidAuthenticated}
                title={p.orcid ? (p.verification.orcidAuthenticated ? "ORCID iD authenticated" : "ORCID iD listed") : "No ORCID iD on file"}
              >
                {p.orcid
                  ? p.verification.orcidAuthenticated
                    ? "Proven by signing in with ORCID."
                    : "Given on the manuscript; not yet proven by signing in with ORCID."
                  : "Profiles with an ORCID iD can show citations across the author's whole career."}
              </Check>
              <Check ok={checks.total > 0 && checks.sealed === checks.total} title={`${checks.sealed} of ${checks.total} publications sealed`}>
                Each sealed record and PDF is re-hashed live on its own verification page; any later change shows up there.
              </Check>
              <Check ok={checks.total > 0 && checks.withDoi === checks.total} title={`${checks.withDoi} of ${checks.total} with a DOI`}>
                Persistent identifiers that resolve through doi.org.
              </Check>
              <Check ok={checks.authorshipConfirmed > 0} title={`Authorship confirmed on ${checks.authorshipConfirmed} of ${checks.total}`}>
                As the submitting author, or by answering the co-author confirmation sent to the email on the manuscript.
              </Check>
              {integrityCount > 0 && (
                <li className="flex gap-3 py-3 last:pb-0">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
                  <p className="text-sm text-foreground">
                    {integrityCount} publication{integrityCount === 1 ? " carries" : "s carry"} an editorial notice, shown on {integrityCount === 1 ? "it" : "them"} below.
                  </p>
                </li>
              )}
            </ul>
            {certificates.length > 0 && (
              <details className="group mt-4 border-t border-border/70 pt-3">
                <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted [&::-webkit-details-marker]:hidden">
                  <FileBadge2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Certificates</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums text-primary">{certificates.length}</span>
                  <span className="ml-auto text-xs font-medium text-primary group-open:hidden">Show</span>
                  <span className="ml-auto hidden text-xs font-medium text-primary group-open:inline">Hide</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <ul className="mt-2 space-y-2">
                  {certificates.map((c) => (
                    <li key={c.serialNumber}>
                      <a href={`/verify/${encodeURIComponent(c.serialNumber)}`} className="block rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/40 hover:bg-[var(--royal-50)]">
                        <span className="font-semibold text-foreground">
                          {c.type.charAt(0) + c.type.slice(1).toLowerCase()} · {c.category.charAt(0) + c.category.slice(1).toLowerCase()}
                        </span>
                        <span className="block truncate text-muted-foreground">{c.workTitle || c.journalName}</span>
                        <span className="mt-0.5 block font-mono text-[0.7rem] text-primary">{c.serialNumber} · verify</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-4 flex items-center gap-1.5 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Checked live on {fmtDay(p.verification.checkedAt)}
            </p>
          </Panel>

          {links.length > 0 && (
            <Panel title="Links" Icon={Globe}>
              <ul className="space-y-1">
                {links.map(({ href, label, Icon }) => (
                  <li key={href}>
                    <a
                      href={href}
                      target={href.startsWith("mailto:") ? undefined : "_blank"}
                      rel="noopener noreferrer me"
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground/85 hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Share this profile" Icon={Users}>
            <ProfileSharePanel url={url} name={name} qr={qr} fileName={`${p.slug}-profile-qr.png`} />
          </Panel>

          {p.coAuthors.length > 0 && (
            <Panel title="Co-authors" Icon={Users}>
              <ul className="space-y-1">
                {p.coAuthors.map((c) => (
                  <li key={c.slug}>
                    <a href={`/authors/${encodeURIComponent(c.slug)}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--royal-100)] text-xs font-semibold text-primary">
                        {initialsOf(displayCase(c.name))}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{displayCase(c.name)}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {c.count} joint
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="rounded-2xl border border-dashed border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Profile ID</span> <span className="font-mono">{p.slug}</span>
            </p>
            <p className="mt-1">
              Built from the published record of {site}; it updates as soon as new work is published.
              {p.memberSince ? ` Account holder since ${p.memberSince.getUTCFullYear()}.` : ""}
            </p>
            <a href={`/api/authors/${encodeURIComponent(p.slug)}`} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
              <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> Machine-readable record (JSON)
            </a>
          </div>
        </aside>
      </div>
    </AuthorProfileShell>
  );
}
