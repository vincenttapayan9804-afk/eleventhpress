"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, CheckCircle2, AlertTriangle, XCircle, Info, Settings2, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { stateForPath } from "@/lib/spa-routes";
import { applyRoute } from "@/components/spa-url-sync";

interface NotificationItem {
  id: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  message: string;
  category: string;
  link: string | null;
  articleId: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 60_000;

const TYPE_ICON = {
  SUCCESS: { Icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  WARNING: { Icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  ERROR: { Icon: XCircle, cls: "text-destructive" },
  INFO: { Icon: Info, cls: "text-primary" },
} as const;

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The header's notification centre: an unread badge kept current (polled
 * every minute, refreshed when the tab regains focus or the signed-in
 * account changes) and a panel with the latest notifications.
 */
export function NotificationBell({ label }: { label: string }) {
  const userId = useApp((s) => s.user?.id);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const refreshCount = useCallback(() => {
    if (!userId) return;
    apiFetch<{ unread: number }>("/api/notifications?count=1")
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refreshCount();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshCount();
    }, POLL_MS);
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, refreshCount]);

  useEffect(() => {
    if (!open || !userId) return;
    apiFetch<{ notifications: NotificationItem[]; unread: number }>("/api/notifications")
      .then((r) => {
        setItems(r.notifications);
        setUnread(r.unread);
      })
      .catch(() => setItems([]));
  }, [open, userId]);

  if (!userId) return null;

  const markRead = (id?: string) => {
    setItems((prev) => prev?.map((n) => (!id || n.id === id ? { ...n, read: true } : n)) ?? prev);
    setUnread((u) => (id ? Math.max(0, u - 1) : 0));
    apiFetch("/api/notifications", { method: "POST", body: JSON.stringify(id ? { notificationId: id } : {}) }).catch(() => {});
  };

  const openItem = (n: NotificationItem) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    const target = n.link ? stateForPath(n.link.split("#")[0].split("?")[0], n.link.includes("?") ? n.link.slice(n.link.indexOf("?")) : "") : null;
    if (target) applyRoute(target);
    else if (n.link) window.location.assign(n.link);
    else if (n.articleId) useApp.getState().openArticle(n.articleId);
  };

  const shown = (items ?? []).filter((n) => filter === "all" || !n.read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-11 sm:size-9" aria-label={unread ? `${label} (${unread} unread)` : label}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--royal-500)] px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-display text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">{unread ? `${unread} unread` : "You're all caught up"}</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex rounded-md border border-border p-0.5 text-xs">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded px-2 py-1 capitalize ${filter === f ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => markRead()} disabled={!unread} aria-label="Mark all as read" title="Mark all as read">
              <CheckCheck className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto">
          {items === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : shown.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Bell className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Decisions, review requests and updates will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((n) => {
                const { Icon, cls } = TYPE_ICON[n.type] ?? TYPE_ICON.INFO;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${n.read ? "" : "bg-[var(--royal-100)]/40 dark:bg-white/[0.03]"}`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${cls}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-sm ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</span>
                          {!n.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--royal-500)]" aria-label="Unread" />}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.message}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              useApp.getState().openDashboard("profile");
              window.setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" }), 400);
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Settings2 className="h-3.5 w-3.5" /> Email preferences
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
