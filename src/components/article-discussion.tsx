"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Flag, Loader2, MessagesSquare, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";

interface Comment {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
  isAuthor: boolean;
  isEditor: boolean;
  author: { name: string; avatarUrl: string | null; affiliation: string | null };
  status?: string;
  reports?: number;
}

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const initials = (n: string) => n.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

/**
 * Post-publication discussion under a published article: comments and
 * one level of replies from signed-in readers, with the article's author
 * and editors labelled. Editors can hide comments; anyone can report one.
 */
export function ArticleDiscussion({ articleId }: { articleId: string }) {
  const user = useApp((s) => s.user);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ comments: Comment[]; canModerate: boolean }>(`/api/articles/${articleId}/comments`)
      .then((r) => {
        setComments(r.comments);
        setCanModerate(r.canModerate);
      })
      .catch(() => setComments([]));
  }, [articleId]);
  useEffect(load, [load]);

  const post = async (body: string, parentId?: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/articles/${articleId}/comments`, { method: "POST", body: JSON.stringify({ body, parentId }) });
      if (parentId) {
        setReplyTo(null);
        setReplyDraft("");
      } else setDraft("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (commentId: string, action: "hide" | "show" | "report") => {
    try {
      await apiFetch(`/api/articles/${articleId}/comments`, { method: "PATCH", body: JSON.stringify({ commentId, action }) });
      if (action === "report") toast.success("Thanks — the editors will take a look");
      else load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const remove = async (commentId: string) => {
    await apiFetch(`/api/articles/${articleId}/comments?commentId=${commentId}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const top = (comments ?? []).filter((c) => !c.parentId);
  const replies = (id: string) => (comments ?? []).filter((c) => c.parentId === id);

  const item = (c: Comment, isReply = false) => (
    <div key={c.id} className={`flex gap-3 ${isReply ? "mt-4" : ""} ${c.status === "HIDDEN" ? "opacity-60" : ""}`}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        {c.author.avatarUrl && <AvatarImage src={c.author.avatarUrl} alt="" className="object-cover" />}
        <AvatarFallback className="bg-primary/10 text-[0.65rem] font-semibold text-primary">{initials(c.author.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">{c.author.name}</span>
          {c.isAuthor && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">Author</span>}
          {c.isEditor && <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold">Editor</span>}
          <span className="text-xs text-muted-foreground">{c.author.affiliation ? `${c.author.affiliation} · ` : ""}{when(c.createdAt)}</span>
          {c.status === "HIDDEN" && <span className="text-xs text-rose-600">Hidden</span>}
          {canModerate && !!c.reports && <span className="text-xs text-amber-700">{c.reports} report{c.reports === 1 ? "" : "s"}</span>}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{c.body}</p>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {!isReply && user && (
            <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => { setReplyTo(c.id); setReplyDraft(""); }}>
              <Reply className="h-3.5 w-3.5" /> Reply
            </button>
          )}
          {user && !c.mine && (
            <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => act(c.id, "report")}>
              <Flag className="h-3.5 w-3.5" /> Report
            </button>
          )}
          {c.mine && (
            <button type="button" className="flex items-center gap-1 hover:text-destructive" onClick={() => remove(c.id)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          {canModerate && (
            <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => act(c.id, c.status === "HIDDEN" ? "show" : "hide")}>
              {c.status === "HIDDEN" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {c.status === "HIDDEN" ? "Show" : "Hide"}
            </button>
          )}
        </div>
        {!isReply && replies(c.id).map((r) => item(r, true))}
        {replyTo === c.id && (
          <div className="mt-3 space-y-2">
            <Textarea autoFocus rows={3} value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder={`Reply to ${c.author.name}`} />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || replyDraft.trim().length < 2} onClick={() => post(replyDraft.trim(), c.id)}>Reply</Button>
              <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section id="discussion" aria-labelledby="discussion-heading" className="mt-10 scroll-mt-24 border-t border-border pt-8">
      <h2 id="discussion-heading" className="flex items-center gap-2 font-display text-xl font-semibold">
        <MessagesSquare className="h-5 w-5 text-primary" /> Discussion
        {top.length > 0 && <span className="text-sm font-normal text-muted-foreground">({(comments ?? []).filter((c) => c.status !== "HIDDEN").length})</span>}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Scholarly, constructive comments about this article. Substantive errors are best raised with the editors, who can issue a correction.
      </p>

      <div className="mt-5">
        {user ? (
          <div className="space-y-2">
            <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Share a question, a related finding or a critique" />
            <Button size="sm" disabled={busy || draft.trim().length < 2} onClick={() => post(draft.trim())}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Post comment
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => useApp.getState().setView("login")}>Sign in</button> to join the discussion.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {comments === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : top.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          top.map((c) => item(c))
        )}
      </div>
    </section>
  );
}
