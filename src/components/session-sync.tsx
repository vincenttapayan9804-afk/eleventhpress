"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { SESSION_ENDED_EVENT } from "@/lib/api-client";
import { SESSION_CHANNEL as CHANNEL } from "@/lib/workspace-client";

const RECHECK_MS = 15_000;

/**
 * Keeps the signed-in state shown on the page in step with the real
 * session cookie, which every tab of the browser shares. Without this, a
 * tab could keep showing "signed in as super admin" after signing out —
 * or signing in as someone else — in another tab, and every action there
 * would fail with "Unauthenticated".
 *
 * - An API call answering 401 (api-client.ts) resets this tab to sign-in.
 * - Returning to the tab re-checks who is signed in; a different account
 *   reloads the page so its platform, branding and dashboard are right.
 * - Signing out in one tab tells the other tabs straight away.
 */
export function SessionSync() {
  const lastCheck = useRef(0);

  useEffect(() => {
    const ended = () => {
      if (!useApp.getState().user) return;
      useApp.setState({ user: null, view: "login", dashboardTab: "overview" });
      toast.error("Your session has ended", {
        id: "session-ended",
        description: "You were signed out, possibly in another tab. Sign in again to continue.",
      });
    };

    const recheck = async (force = false) => {
      const current = useApp.getState().user;
      if (!current) return;
      if (!force && Date.now() - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = Date.now();
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        if (res.status === 401) return ended();
        if (!res.ok) return;
        const { user } = (await res.json()) as { user: { id: string } | null };
        if (user && user.id !== current.id) {
          // Another account signed in from a different tab.
          window.location.assign("/?view=dashboard");
        }
      } catch {
        /* offline — try again next time */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = () => void recheck(true);
    } catch {
      /* BroadcastChannel unsupported — focus checks still apply */
    }

    window.addEventListener(SESSION_ENDED_EVENT, ended);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, ended);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
    };
  }, []);

  return null;
}
