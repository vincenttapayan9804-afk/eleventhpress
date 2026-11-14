"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { useReveal } from "@/hooks/use-scroll-reveal";
import { FileText, FileX, ArrowRight } from "lucide-react";

interface PostItem {
  id: string;
  type: string;
  title: string;
  dek: string | null;
  authorName: string;
  category: string;
  heroImageUrl: string | null;
  publishedAt: string | null;
  /** Set for the newsroom's own stories, which have server-rendered pages at /media/<slug>. */
  href?: string;
}

function postDate(publishedAt: string | null) {
  return publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : "";
}

/**
 * The newsroom's own stories use generated 1200×630 data cards with the
 * headline number and source printed on them. They must be shown whole, at
 * their own proportions, never cropped or zoomed like a photo.
 */
function isDataCard(post: PostItem) {
  return Boolean(post.href && post.heroImageUrl?.endsWith("/cover"));
}

/**
 * A card that opens a post: a real link for the newsroom's server-rendered
 * stories (crawlable, opens in a new tab with the usual gestures), a button
 * that switches the single-page view for dashboard posts.
 */
function PostLink({
  post,
  onOpen,
  className,
  style,
  children,
}: {
  post: PostItem;
  onOpen: (id: string) => void;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (post.href) {
    return (
      <a href={post.href} className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(post.id)} className={className} style={style}>
      {children}
    </button>
  );
}

const FILTER_VALUES = ["ALL", "NEWS", "BLOG"] as const;
const FILTER_KEYS: Record<(typeof FILTER_VALUES)[number], string> = {
  ALL: "filterAll",
  NEWS: "filterNews",
  BLOG: "filterBlog",
};

export function MediaView() {
  const t = useTranslations("media");
  const { openMediaPost } = useApp();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const headerReveal = useReveal();

  useEffect(() => {
    apiFetch<{ posts: PostItem[] }>("/api/media")
      .then((res) => setPosts(res.posts))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (filter === "ALL" ? posts : posts.filter((p) => p.type === filter)),
    [posts, filter]
  );
  const [hero, ...rest] = filtered;
  const heroIsCard = hero ? isDataCard(hero) : false;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-80 shimmer rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div ref={headerReveal.observe} className={`reveal ${headerReveal.inView ? "in-view" : ""} flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground/90 pb-6`}>
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-5xl font-bold tracking-tight sm:text-6xl">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-1 rounded-full border border-foreground/10 p-1">
          {FILTER_VALUES.map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${filter === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(FILTER_KEYS[value])}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center py-24 text-center">
          <FileX className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-medium">{t("nothingPublished")}</p>
        </div>
      ) : (
        <>
          {hero && (
            <PostLink
              post={hero}
              onOpen={openMediaPost}
              className={`cover-click-glow group mt-8 grid w-full gap-0 overflow-hidden rounded-2xl border border-foreground/10 bg-black text-left shadow-[0_24px_64px_oklch(0.38_0.18_295/0.18)] transition-all duration-500 hover:shadow-[0_32px_80px_oklch(0.38_0.18_295/0.28)] ${heroIsCard ? "" : "lg:grid-cols-2"}`}
            >
              <div className={`relative overflow-hidden ${heroIsCard ? "aspect-[1200/630]" : "aspect-[4/3] lg:aspect-auto"}`}>
                {hero.heroImageUrl ? (
                  <img
                    src={hero.heroImageUrl}
                    alt={hero.title}
                    width={heroIsCard ? 1200 : undefined}
                    height={heroIsCard ? 630 : undefined}
                    className={`h-full w-full object-cover transition duration-700 ${heroIsCard ? "group-hover:brightness-110" : "group-hover:scale-105"}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[oklch(0.25_0.08_295)] to-black">
                    <FileText className="h-16 w-16 text-white/30" />
                  </div>
                )}
              </div>
              {heroIsCard ? (
                <div className="grid gap-6 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
                  <div>
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[oklch(0.76_0.11_294)]">{hero.type} · {hero.category}</p>
                    <h2 className="mt-4 font-display text-3xl font-bold leading-[1.08] text-white sm:text-4xl">{hero.title}</h2>
                  </div>
                  <div className="flex flex-col justify-end">
                    {hero.dek && <p className="font-serif text-lg italic leading-relaxed text-white/70">{hero.dek}</p>}
                    <p className="mt-5 text-sm font-medium text-white/60">{t("byAuthorDate", { author: hero.authorName, date: postDate(hero.publishedAt) })}</p>
                    <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-white">
                      {t("readMore")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col justify-center px-8 py-10 sm:px-12 sm:py-14">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[oklch(0.76_0.11_294)]">{hero.type} · {hero.category}</p>
                  <h2 className="mt-4 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl lg:text-5xl">{hero.title}</h2>
                  {hero.dek && <p className="mt-4 max-w-md font-serif text-lg italic leading-relaxed text-white/70">{hero.dek}</p>}
                  <p className="mt-6 text-sm font-medium text-white/60">{t("byAuthorDate", { author: hero.authorName, date: postDate(hero.publishedAt) })}</p>
                  <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-white">
                    {t("readMore")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              )}
            </PostLink>
          )}

          {rest.length > 0 && (
            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post, i) => (
                <PostLink
                  key={post.id}
                  post={post}
                  onOpen={openMediaPost}
                  className="group flex flex-col text-left"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`mb-4 overflow-hidden rounded-lg bg-[var(--royal-100)] ${isDataCard(post) ? "aspect-[1200/630]" : "aspect-[16/10]"}`}>
                    {post.heroImageUrl ? (
                      <img
                        src={post.heroImageUrl}
                        alt={post.title}
                        loading="lazy"
                        width={isDataCard(post) ? 1200 : undefined}
                        height={isDataCard(post) ? 630 : undefined}
                        className={`h-full w-full object-cover transition duration-500 ${isDataCard(post) ? "group-hover:brightness-110" : "group-hover:scale-105"}`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><FileText className="h-8 w-8 text-primary" /></div>
                    )}
                  </div>
                  <Badge variant="outline" className="w-fit border-[var(--royal-300)]/30 bg-[var(--royal-100)]/50 text-[0.65rem] text-primary">{post.type} · {post.category}</Badge>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug transition-colors group-hover:text-primary">{post.title}</h3>
                  {post.dek && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{post.dek}</p>}
                  <p className="mt-3 text-xs font-medium text-muted-foreground">{t("byAuthorDate", { author: post.authorName, date: postDate(post.publishedAt) })}</p>
                </PostLink>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
