"use client";

import { trDashboard } from "@/lib/dashboard-i18n";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Pin, PinOff, Search, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import type { DashboardTabDef } from "@/components/dashboard/dashboard-tabs";

const pinKey = (userId: string) => `epip-dashboard-pins:${userId}`;
const MAX_PINS = 6;

function readPins(userId: string | undefined): string[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(pinKey(userId)) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Dashboard navigation.
 * - Wide screens: the grouped sidebar, with a "Pinned" group on top — any
 *   section can be pinned from its hover pin.
 * - Phones and tablets: a compact bar showing the current section and the
 *   pinned ones, with "All sections" opening a searchable, grouped sheet,
 *   instead of one long sideways-scrolling row of every tab.
 */
export function DashboardNav({ tabs, active, onOpen }: { tabs: DashboardTabDef[]; active: string; onOpen: (key: string) => void }) {
  const userId = useApp((s) => s.user?.id);
  const locale = useApp((s) => s.locale);
  const tr = (text: string) => trDashboard(text, locale);
  const [pins, setPins] = useState<string[]>(() => readPins(userId));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const byKey = useMemo(() => new Map(tabs.map((t) => [t.key, t])), [tabs]);
  const pinned = pins.map((k) => byKey.get(k)).filter(Boolean) as DashboardTabDef[];
  const current = byKey.get(active);

  const togglePin = (key: string) => {
    const next = pins.includes(key) ? pins.filter((k) => k !== key) : [...pins, key].slice(-MAX_PINS);
    setPins(next);
    try {
      if (userId) localStorage.setItem(pinKey(userId), JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? tabs.filter((t) => t.label.toLowerCase().includes(q) || t.group.toLowerCase().includes(q)) : tabs;
    const map = new Map<string, DashboardTabDef[]>();
    for (const t of list) map.set(t.group, [...(map.get(t.group) ?? []), t]);
    return [...map.entries()];
  }, [tabs, filter]);

  const item = (t: DashboardTabDef, opts: { inPinned?: boolean; onDone?: () => void } = {}) => {
    const Icon = t.icon;
    const isActive = active === t.key;
    const isPinned = pins.includes(t.key);
    return (
      <div key={`${opts.inPinned ? "pin-" : ""}${t.key}`} className="group relative">
        <button
          onClick={() => {
            onOpen(t.key);
            opts.onDone?.();
          }}
          aria-current={isActive ? "page" : undefined}
          className={`flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 py-2 pr-9 text-left font-sans text-sm font-medium transition-colors ${
            isActive ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-accent"
          }`}
        >
          <Icon className="h-4 w-4 flex-shrink-0" /> <span className="truncate">{tr(t.label)}</span>
        </button>
        <button
          type="button"
          onClick={() => togglePin(t.key)}
          aria-label={isPinned ? `Unpin ${t.label}` : `Pin ${t.label}`}
          title={isPinned ? "Unpin" : "Pin to top"}
          className={`absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded transition-opacity focus-visible:opacity-100 ${
            isPinned ? "opacity-70" : "opacity-0 group-hover:opacity-70"
          } ${isActive ? "text-primary-foreground hover:bg-white/15" : "text-muted-foreground hover:bg-muted"}`}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Phones and tablets */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm font-medium"
        >
          {current ? <current.icon className="h-4 w-4 flex-shrink-0 text-primary" /> : <LayoutGrid className="h-4 w-4" />}
          <span className="truncate">{current ? tr(current.label) : "Sections"}</span>
          <ChevronDown className="ml-auto h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </button>
        {pinned
          .filter((t) => t.key !== active)
          .slice(0, 3)
          .map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onOpen(t.key)}
                aria-label={tr(t.label)}
                title={tr(t.label)}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground/80"
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background px-4 pb-3 pt-4">
            <SheetTitle className="font-display">Dashboard sections</SheetTitle>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a section" className="h-10 pl-9" />
            </div>
          </SheetHeader>
          <div className="space-y-4 px-3 py-4">
            {!filter && pinned.length > 0 && (
              <div>
                <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{tr("Pinned")}</p>
                {pinned.map((t) => item(t, { inPinned: true, onDone: () => setSheetOpen(false) }))}
              </div>
            )}
            {groups.map(([group, list]) => (
              <div key={group}>
                <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{tr(group)}</p>
                {list.map((t) => item(t, { onDone: () => setSheetOpen(false) }))}
              </div>
            ))}
            {groups.length === 0 && <p className="px-3 text-sm text-muted-foreground">No section matches “{filter}”.</p>}
          </div>
        </SheetContent>
      </Sheet>

      {/* Wide screens */}
      <nav aria-label="Dashboard" className="hidden flex-col gap-0.5 lg:flex">
        {pinned.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-1 font-sans text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{tr("Pinned")}</p>
            {pinned.map((t) => item(t, { inPinned: true }))}
          </>
        )}
        {tabs.map((t, i) => (
          <Fragment key={t.key}>
            {(i === 0 || tabs[i - 1].group !== t.group) && (
              <p className={`px-3 pb-1 font-sans text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground ${i === 0 && pinned.length === 0 ? "pt-1" : "pt-4"}`}>
                {tr(t.group)}
              </p>
            )}
            {item(t)}
          </Fragment>
        ))}
      </nav>
    </>
  );
}
