import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BookOpen, Eye, Quote, Globe, Linkedin, Github, Twitter, Mail, MapPin, ExternalLink } from "lucide-react";
import { APP_BASE_URL } from "@/lib/site";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { getAuthorProfile } from "@/lib/author-profile";
import { articlePath } from "@/lib/spa-routes";
import { AuthorProfileShell } from "@/components/authors/author-profile-shell";
import { FollowAuthorButton } from "@/components/authors/follow-author-button";
import { AlertMeButton } from "@/components/alert-me-button";

/**
 * GET /authors/[slug] — a public, crawlable profile for every author with
 * a published article (src/lib/author-profile.ts), with Person JSON-LD.
 */
export const dynamic = "force-dynamic";

async function load(slug: string) {
  const tenant = await resolveTenantFromHeaders(await headers());
  return getAuthorProfile(slug, tenant?.id ?? null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Author not found" };
  const description =
    p.bio?.slice(0, 200) ||
    `${p.name}${p.affiliation ? `, ${p.affiliation}` : ""} — ${p.articles.length} publication${p.articles.length === 1 ? "" : "s"} in ${p.disciplines.join(", ")}.`;
  const url = `${APP_BASE_URL}/authors/${encodeURIComponent(p.slug)}`;
  return {
    title: `${p.name} — Author profile`,
    description,
    alternates: { canonical: url },
    openGraph: { title: p.name, description, url, type: "profile", images: p.avatarUrl ? [p.avatarUrl] : undefined },
  };
}

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "");

export default async function AuthorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();

  const initials = p.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const links = [
    p.links.website && { href: p.links.website, label: "Website", Icon: Globe },
    p.orcid && { href: `https://orcid.org/${p.orcid}`, label: "ORCID", Icon: ExternalLink },
    p.links.linkedin && { href: p.links.linkedin, label: "LinkedIn", Icon: Linkedin },
    p.links.twitter && { href: p.links.twitter, label: "X", Icon: Twitter },
    p.links.github && { href: p.links.github, label: "GitHub", Icon: Github },
    p.links.email && { href: `mailto:${p.links.email}`, label: "Email", Icon: Mail },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Globe }[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    url: `${APP_BASE_URL}/authors/${encodeURIComponent(p.slug)}`,
    ...(p.affiliation ? { affiliation: { "@type": "Organization", name: p.affiliation } } : {}),
    ...(p.orcid ? { identifier: `https://orcid.org/${p.orcid}`, sameAs: [`https://orcid.org/${p.orcid}`] } : {}),
    ...(p.avatarUrl ? { image: p.avatarUrl } : {}),
    ...(p.bio ? { description: p.bio } : {}),
  };

  return (
    <AuthorProfileShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <a href="/authors" className="text-sm font-medium text-primary hover:underline">← All authors</a>

        <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt={p.name} className="h-28 w-28 flex-shrink-0 rounded-2xl object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display text-3xl font-semibold text-primary ring-1 ring-border">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{p.disciplines.join(" · ")}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{p.name}</h1>
            {(p.profession || p.affiliation) && (
              <p className="mt-1 text-muted-foreground">{[p.profession, p.affiliation].filter(Boolean).join(" · ")}</p>
            )}
            {p.country && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {p.country}</p>
            )}
            {links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {links.map(({ href, label, Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer me" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </a>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {p.accountId && <FollowAuthorButton accountId={p.accountId} initialCount={p.followerCount} />}
              <AlertMeButton kind="AUTHOR" query={p.orcid || p.name} label="Alert me about new work" size="default" />
            </div>
          </div>
        </header>

        {p.bio && <p className="mt-8 max-w-3xl whitespace-pre-line leading-relaxed text-foreground/90">{p.bio}</p>}

        <section aria-label="Metrics" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Publications here", value: p.articles.length, Icon: BookOpen },
            { label: p.metrics.source === "openalex" ? "Citations (all work)" : "Citations", value: p.metrics.citedBy ?? 0, Icon: Quote },
            { label: p.metrics.source === "openalex" ? "h-index (OpenAlex)" : "h-index (this platform)", value: p.metrics.hIndex ?? 0, Icon: Quote },
            { label: "Article views", value: p.totals.views, Icon: Eye },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <Icon className="h-4 w-4 text-primary" />
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_260px]">
          <section aria-labelledby="pubs">
            <h2 id="pubs" className="font-display text-xl font-semibold">Publications</h2>
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
              {p.articles.map((a) => (
                <li key={a.id} className="p-5">
                  <p className="text-xs text-muted-foreground">{a.discipline} · {fmtDate(a.publishedAt)}{a.doi ? ` · doi:${a.doi}` : ""}</p>
                  <a href={articlePath(a.id, a.title)} className="mt-1 block font-display text-lg font-semibold leading-snug hover:text-primary">{a.title}</a>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.authors.map((x, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        {x.slug.toUpperCase() === p.slug.toUpperCase() ? <strong className="text-foreground">{x.name}</strong> : <a href={`/authors/${encodeURIComponent(x.slug)}`} className="hover:underline">{x.name}</a>}
                      </span>
                    ))}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{a.abstract}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{a.citations} citations · {a.views.toLocaleString()} views</p>
                </li>
              ))}
            </ul>
          </section>
          {p.coAuthors.length > 0 && (
            <aside aria-labelledby="coauthors">
              <h2 id="coauthors" className="font-display text-xl font-semibold">Co-authors</h2>
              <ul className="mt-4 space-y-2">
                {p.coAuthors.map((c) => (
                  <li key={c.slug}>
                    <a href={`/authors/${encodeURIComponent(c.slug)}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                      <span className="truncate">{c.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{c.count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </AuthorProfileShell>
  );
}
