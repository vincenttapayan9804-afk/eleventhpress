"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { ArrowLeft, Loader2 } from "lucide-react";

interface PostDetail {
  id: string;
  type: string;
  title: string;
  dek: string | null;
  authorName: string;
  category: string;
  bodyHtml: string;
  heroImageUrl: string | null;
  publishedAt: string | null;
}

function postDate(publishedAt: string | null) {
  return publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : "";
}

export function MediaPostView() {
  const { mediaPostId, setView } = useApp();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mediaPostId) return;
    setLoading(true);
    apiFetch<{ post: PostDetail }>(`/api/media/${mediaPostId}`)
      .then((res) => setPost(res.post))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [mediaPostId]);

  if (loading || !post) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <button onClick={() => setView("media")} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to News &amp; Notes
      </button>
      <p className="eyebrow mt-6">{post.type} · {post.category}</p>
      <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] sm:text-5xl">{post.title}</h1>
      {post.dek && <p className="mt-4 font-serif text-xl italic leading-relaxed text-muted-foreground">{post.dek}</p>}
      <p className="mt-6 border-t border-foreground/10 pt-4 text-sm font-medium">By {post.authorName} · {postDate(post.publishedAt)}</p>
      {post.heroImageUrl && (
        <img src={post.heroImageUrl} alt={post.title} className="mt-8 w-full rounded-xl object-cover" />
      )}
      <div className="prose prose-stone mt-8 max-w-none font-serif text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
    </div>
  );
}
