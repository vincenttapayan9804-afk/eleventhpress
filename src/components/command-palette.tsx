"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, User, BookOpen, Newspaper, Mic, GraduationCap, Compass, LogOut, Loader2, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { stateForPath, VIEW_META } from "@/lib/spa-routes";
import { applyRoute } from "@/components/spa-url-sync";
import { tabsForRole } from "@/components/dashboard/dashboard-tabs";

interface ResultItem { title: string; subtitle: string; path: string }
interface ResultGroup { key: string; label: string; items: ResultItem[] }

const GROUP_ICON: Record<string, typeof FileText> = {
  articles: FileText,
  authors: User,
  books: BookOpen,
  magazines: Newspaper,
  podcasts: Mic,
  resources: GraduationCap,
};

const PAGES = (["browse", "books", "magazines", "podcasts", "media", "authors", "experts", "collections", "resources", "about", "pricing", "faqs", "policies", "charter"] as const)
  .map((view) => ({ view, title: VIEW_META[view]?.title ?? view }));

/** Opens a path: in place when the single-page site has it, otherwise as a page load. */
export function openPath(path: string) {
  const [pathname, search = ""] = path.split("?");
  const route = stateForPath(pathname, search ? `?${search}` : "");
  // Article pages and the SPA's own views open in place; everything else
  // (author profiles, resource articles) is its own server-rendered page.
  if (route) applyRoute(route);
  else window.location.assign(path);
}

/**
 * ⌘K / Ctrl+K (or "/") from anywhere: search articles, authors, books,
 * magazines, podcasts and resources, jump to any page, or open any
 * dashboard section the signed-in role can see.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const user = useApp((s) => s.user);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  const onQuery = (v: string) => {
    setQ(v);
    const short = v.trim().length < 2;
    if (short) setGroups([]);
    setLoading(!short);
  };

  useEffect(() => {
    const term = q.trim();
    const id = ++seq.current;
    if (term.length < 2) return;
    const t = window.setTimeout(() => {
      apiFetch<{ groups: ResultGroup[] }>(`/api/search/all?q=${encodeURIComponent(term)}`)
        .then((r) => id === seq.current && setGroups(r.groups))
        .catch(() => id === seq.current && setGroups([]))
        .finally(() => id === seq.current && setLoading(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  const tabs = useMemo(() => tabsForRole(user?.role), [user?.role]);

  const run = (fn: () => void) => {
    setOpen(false);
    onQuery("");
    fn();
  };

  const term = q.trim();

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search articles, authors and pages, or jump to a dashboard section"
      className="sm:max-w-2xl"
    >
      {/* Server results are already matched; cmdk's own filter still narrows pages and tabs. */}
      <CommandInput value={q} onValueChange={onQuery} placeholder="Search articles, authors, books, pages…" className="!border-0 !shadow-none !ring-0 !outline-none" />
      <CommandList className="max-h-[min(65vh,460px)]">
        <CommandEmpty>
          {loading ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</span>
          ) : term.length < 2 ? (
            "Type to search"
          ) : (
            `No results for “${term}”`
          )}
        </CommandEmpty>

        {groups.map((g) => {
          const Icon = GROUP_ICON[g.key] ?? Search;
          return (
            <CommandGroup key={g.key} heading={g.label}>
              {g.items.map((it) => (
                <CommandItem
                  key={`${g.key}:${it.path}:${it.title}`}
                  // Include the query so cmdk's filter never hides a server match.
                  value={`${g.key} ${it.title} ${it.subtitle} ${term}`}
                  onSelect={() => run(() => openPath(it.path))}
                >
                  <Icon className="text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{it.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{it.subtitle}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {groups.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem key={p.view} value={`page ${p.title}`} onSelect={() => run(() => applyRoute({ view: p.view }))}>
              <Compass className="text-muted-foreground" />
              {p.title}
            </CommandItem>
          ))}
          {!user && (
            <>
              <CommandItem value="page sign in log in" onSelect={() => run(() => applyRoute({ view: "login" }))}>
                <User className="text-muted-foreground" /> Sign in
              </CommandItem>
              <CommandItem value="page create account register sign up" onSelect={() => run(() => applyRoute({ view: "register" }))}>
                <User className="text-muted-foreground" /> Create an account
              </CommandItem>
            </>
          )}
        </CommandGroup>

        {user && tabs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Dashboard">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <CommandItem
                    key={t.key}
                    value={`dashboard ${t.label} ${t.group}`}
                    onSelect={() => run(() => useApp.getState().openDashboard(t.key as any))}
                  >
                    <Icon className="text-muted-foreground" />
                    <span className="flex-1">{t.label}</span>
                    <CommandShortcut>{t.group.replace(/ — .*/, "")}</CommandShortcut>
                  </CommandItem>
                );
              })}
              <CommandItem value="sign out log out" onSelect={() => run(() => useApp.getState().logout())}>
                <LogOut className="text-muted-foreground" /> Sign out
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Header button that opens the palette (shows the shortcut on wide screens). */
export function SearchButton({ label = "Search" }: { label?: string }) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      aria-label={label}
      className="flex size-11 items-center justify-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-9 2xl:w-auto 2xl:border 2xl:border-border 2xl:px-3"
    >
      <Search className="h-4 w-4" />
      <span className="hidden 2xl:inline">{label}</span>
      <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] 2xl:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );
}
