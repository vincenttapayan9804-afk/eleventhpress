import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { SpaShell } from "@/components/spa-shell";
import { stateForPath, viewDescription, VIEW_META } from "@/lib/spa-routes";
import { getCurrentTenant } from "@/lib/tenant";
import { APP_BASE_URL } from "@/lib/site";

/**
 * Every page of the single-page site other than "/" — /articles, /about,
 * /dashboard/profile, /magazines/<id> and so on (src/lib/spa-routes.ts).
 * Renders the same SpaShell as "/", opened on the view the URL names, so
 * direct visits, refreshes and shared links land on the right page.
 * Anything that isn't one of those paths is a real 404.
 */

type Props = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pathOf(slug: string[]) {
  return "/" + slug.map((s) => {
    try {
      return encodeURIComponent(decodeURIComponent(s));
    } catch {
      return encodeURIComponent(s);
    }
  }).join("/");
}

function searchOf(sp: Record<string, string | string[] | undefined>) {
  const tab = sp.tab;
  return typeof tab === "string" ? `?tab=${encodeURIComponent(tab)}` : "";
}

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const route = stateForPath(pathOf(slug));
  if (!route) return {};
  const tenant = await getCurrentTenant().catch(() => null);
  const siteName = tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : null;
  const base = (await parent).title?.absolute || siteName || "Eleventh Press International Publishing™";
  const meta = VIEW_META[route.view];
  if (!meta) return { title: base, alternates: { canonical: `${APP_BASE_URL}${pathOf(slug)}` } };
  const description = viewDescription(meta.description, siteName);
  return {
    title: `${meta.title} — ${base}`,
    description,
    alternates: { canonical: `${APP_BASE_URL}${pathOf(slug)}` },
    robots: meta.index === false ? { index: false, follow: true } : undefined,
    openGraph: { title: `${meta.title} — ${base}`, description, url: `${APP_BASE_URL}${pathOf(slug)}` },
  };
}

export default async function SpaRoutePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const route = stateForPath(pathOf(slug), searchOf(await searchParams));
  if (!route) notFound();
  return <SpaShell initialRoute={route} />;
}
