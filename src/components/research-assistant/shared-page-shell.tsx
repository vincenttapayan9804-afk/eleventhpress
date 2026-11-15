"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { pathForState } from "@/lib/spa-routes";
import { apiFetch } from "@/lib/api-client";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";

/**
 * Chrome for the server-rendered shared Research Assistant conversation
 * (/research/shared/<token>): the site header and footer, and picking any
 * destination from the header opens it in the single-page app.
 */
export function SharedConversationShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const start = useApp.getState();
    return useApp.subscribe((s) => {
      if (s.view !== start.view || s.articleId !== start.articleId) router.push(pathForState(s) ?? "/");
    });
  }, [router]);
  return (
    <I18nProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Toaster richColors position="top-right" />
      </div>
    </I18nProvider>
  );
}

/** "Continue this conversation": copies it into the signed-in reader's own history. */
export function ContinueSharedButton({ token }: { token: string }) {
  const user = useApp((s) => s.user);
  const setView = useApp((s) => s.setView);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        Copied to your conversations. Open <span className="font-medium text-foreground">Ask the Corpus</span> (bottom right) to continue it.
      </p>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!user) {
          toast.info("Sign in to copy this conversation into your own history and continue it.");
          setView("login");
          return;
        }
        setBusy(true);
        try {
          await apiFetch(`/api/corpus-chat/shared/${encodeURIComponent(token)}/copy`, { method: "POST" });
          setDone(true);
          toast.success("Copied to your conversations.");
        } catch (e: any) {
          toast.error(e?.message || "The conversation couldn't be copied.");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
      Continue this conversation
    </button>
  );
}
