"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, Bell, LogOut, LayoutDashboard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SiteHeader() {
  const { view, setView, user, logout, openDashboard, mobileNavOpen, setMobileNavOpen } = useApp();
  const [unread, setUnread] = useState(0);
  const t = useTranslations("nav");
  const tHeader = useTranslations("header");

  const NAV_ITEMS = [
    { label: t("home"), view: "home" as const },
    { label: t("articles"), view: "browse" as const },
    { label: t("authors"), view: "authors" as const },
    { label: t("experts"), view: "experts" as const },
    { label: t("resources"), view: "resources" as const },
    { label: t("collections"), view: "collections" as const },
    { label: t("about"), view: "about" as const },
    { label: t("faqs"), view: "faqs" as const },
    { label: t("policies"), view: "policies" as const },
  ];

  useState(() => {
    if (!user) return;
    apiFetch<{ notifications: any[] }>("/api/notifications")
      .then(({ notifications }) => {
        setUnread(notifications.filter((n) => !n.read).length);
      })
      .catch(() => {});
  });

  const initials = user?.fullName?.split(" ").map((s) => s[0]).slice(0, 2).join("") ?? "EP";

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Glassmorphic header */}
      <div className="glass-strong border-b border-[oklch(0.76_0.11_294/0.15)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <button onClick={() => setView("home")} className="flex flex-shrink-0 items-center gap-3 text-left group">
            <span className="wax-mark group-hover:scale-105 transition-transform duration-500" style={{ transitionTimingFunction: "var(--ease-luxury)" }}>
              <span className="wax-mark-text">EP</span>
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="font-display text-base font-semibold text-foreground">
                {tHeader("brandName")}
              </span>
              <span className="text-[0.62rem] font-sans font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {tHeader("brandTagline")}
              </span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-4 overflow-x-auto whitespace-nowrap px-2 xl:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                data-active={view === item.view}
                className="nav-underline flex-shrink-0 font-sans text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
              >
                {item.label}
              </button>
            ))}
            {user && (
              <button
                onClick={() => openDashboard("overview")}
                data-active={view === "dashboard"}
                className="nav-underline flex flex-shrink-0 items-center gap-1.5 font-sans text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> {t("dashboard")}
              </button>
            )}
          </nav>

          {/* Right side */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {user ? (
              <>
                {unread > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDashboard("overview")}
                    className="relative"
                    aria-label={t("notifications")}
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-1 top-1 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.50_0.18_296)] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[oklch(0.50_0.18_296)]" />
                    </span>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3">
                      <Avatar className="h-7 w-7 border border-[oklch(0.76_0.11_294/0.3)]">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} className="object-cover" />}
                        <AvatarFallback className="bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] text-xs font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden text-sm font-medium sm:inline">
                        {user.fullName.split(" ").slice(-1)}
                      </span>
                      <Badge variant="outline" className="hidden text-[0.6rem] font-mono lg:inline border-[oklch(0.76_0.11_294/0.3)]">
                        {user.role.replace("_", " ")}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-strong w-64">
                    <DropdownMenuLabel>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{user.fullName}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                        <Badge variant="secondary" className="mt-1 w-fit text-[0.6rem]">
                          {user.role.replace("_", " ")}
                        </Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openDashboard("overview")}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> {t("dashboard")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => logout()}>
                      <LogOut className="mr-2 h-4 w-4" /> {t("signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={() => setView("login")} size="sm" className="btn-royal-glow hidden sm:inline-flex">
                {t("signIn")}
              </Button>
            )}

            <LanguageSwitcher />

            {/* Mobile nav */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="xl:hidden" aria-label={t("menu")}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="glass-strong w-72">
                <SheetHeader>
                  <SheetTitle className="font-display text-foreground">
                    Eleventh Press
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.view}
                      onClick={() => { setView(item.view); setMobileNavOpen(false); }}
                      className="rounded-md px-3 py-2 text-left font-sans text-sm font-medium hover:bg-[oklch(0.93_0.04_290)] transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                  {user && (
                    <button
                      onClick={() => { openDashboard("overview"); setMobileNavOpen(false); }}
                      className="rounded-md px-3 py-2 text-left font-sans text-sm font-medium hover:bg-[oklch(0.93_0.04_290)] transition-colors"
                    >
                      {t("dashboard")}
                    </button>
                  )}
                  {!user && (
                    <button
                      onClick={() => { setView("login"); setMobileNavOpen(false); }}
                      className="mt-2 rounded-md bg-[oklch(0.42_0.18_295)] px-3 py-2 text-left font-sans text-sm font-medium text-white"
                    >
                      {t("signIn")}
                    </button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
