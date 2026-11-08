"use client";

import { NotificationBell } from "@/components/notification-bell";
import { SpaLink } from "@/components/spa-link";
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
import { Menu, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
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
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { SoundToggle } from "@/components/ui-sound";
import { useTenantBranding } from "@/lib/tenant-branding-context";

export function SiteHeader() {
  const { view, setView, user, logout, openDashboard, mobileNavOpen, setMobileNavOpen } = useApp();
  const branding = useTenantBranding();
  const t = useTranslations("nav");
  const tHeader = useTranslations("header");

  const NAV_ITEMS = [
    { label: t("home"), view: "home" as const },
    { label: t("authors"), view: "authors" as const },
    { label: t("experts"), view: "experts" as const },
    { label: t("resources"), view: "resources" as const },
    { label: t("collections"), view: "collections" as const },
    { label: t("about"), view: "about" as const },
    { label: t("faqs"), view: "faqs" as const },
    { label: t("policies"), view: "policies" as const },
  ];

  const PUBLICATIONS_ITEMS = [
    { label: t("articles"), view: "browse" as const },
    { label: t("books"), view: "books" as const },
    { label: t("magazines"), view: "magazines" as const },
    { label: t("podcasts"), view: "podcasts" as const },
    { label: t("media"), view: "media" as const },
  ];
  const publicationsActive =
    view === "browse" || view === "books" || view === "magazines" || view === "magazineIssue" ||
    view === "podcasts" || view === "media" || view === "mediaPost";

  const initials = user?.fullName?.split(" ").map((s) => s[0]).slice(0, 2).join("") ?? "EP";

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Visitor opened a tenant's public portal link (/t/<slug>) on the
          official site — say whose platform this is and offer the way back. */}
      {branding.source === "portal" && (
        <div className="bg-primary px-4 py-1.5 text-center text-xs text-primary-foreground" data-testid="portal-banner">
          You&apos;re viewing the {branding.siteName || branding.tenantName} research platform ·{" "}
          <a href="/t/exit" className="font-medium underline underline-offset-2">
            Back to Eleventh Press
          </a>
        </div>
      )}
      {/* Glassmorphic header */}
      <div className="glass-strong border-b border-[var(--royal-300)]/15">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
          {/* Brand — was `hidden ... sm:flex`, so the name/tagline never
              rendered below 640px and only the logo mark showed on phones.
              Now always visible; the wrapper can shrink+truncate (instead
              of the whole button being flex-shrink-0) so on the tightest
              screens it degrades to an ellipsis rather than overflowing. */}
          <SpaLink to={{ view: "home" }} onNavigate={() => setView("home")} className="flex min-w-0 items-center gap-2.5 text-left group sm:gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.siteName || tHeader("brandName")}
                className="h-9 w-auto max-w-[120px] flex-shrink-0 object-contain group-hover:scale-105 transition-transform duration-500"
                style={{ transitionTimingFunction: "var(--ease-luxury)" }}
              />
            ) : (
              <span className="wax-mark flex-shrink-0 group-hover:scale-105 transition-transform duration-500" style={{ transitionTimingFunction: "var(--ease-luxury)" }}>
                <span className="wax-mark-text">EP</span>
              </span>
            )}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
                {branding.siteName || tHeader("brandName")}
              </span>
              <span className="truncate text-[0.55rem] font-sans font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-[0.62rem] sm:tracking-[0.22em]">
                {branding.tagline || (branding.isPlatform ? tHeader("brandTagline") : "Research Platform")}
              </span>
            </span>
          </SpaLink>

          {/* Desktop nav */}
          <nav className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 px-2 xl:flex 2xl:gap-x-5">
            <SpaLink
              to={{ view: "home" }}
              onNavigate={() => setView("home")}
              data-active={view === "home"}
              className="nav-underline flex-shrink-0 whitespace-nowrap font-sans text-[0.83rem] font-medium text-foreground/80 hover:text-foreground transition-colors 2xl:text-sm"
            >
              {t("home")}
            </SpaLink>

            {/* Publications dropdown — replaces the old flat "Articles"
                link so Journal Articles and Books can share one nav slot. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                data-active={publicationsActive}
                className="nav-underline flex flex-shrink-0 items-center gap-1 whitespace-nowrap font-sans text-[0.83rem] font-medium text-foreground/80 outline-none hover:text-foreground transition-colors 2xl:text-sm"
              >
                {t("publications")} <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="glass-strong">
                {PUBLICATIONS_ITEMS.map((item) => (
                  <DropdownMenuItem key={item.view} asChild>
                    <SpaLink to={{ view: item.view }} onNavigate={() => setView(item.view)}>
                      {item.label}
                    </SpaLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {NAV_ITEMS.filter((item) => item.view !== "home").map((item) => (
              <SpaLink
                key={item.view}
                to={{ view: item.view }}
                onNavigate={() => setView(item.view)}
                data-active={view === item.view || (item.view === "resources" && view === "resourcePage")}
                data-testid={`nav-${item.view}`}
                className="nav-underline flex-shrink-0 whitespace-nowrap font-sans text-[0.83rem] font-medium text-foreground/80 hover:text-foreground transition-colors 2xl:text-sm"
              >
                {item.label}
              </SpaLink>
            ))}
            {user && (
              <SpaLink
                to={{ view: "dashboard" }}
                onNavigate={() => openDashboard("overview")}
                data-active={view === "dashboard"}
                className="nav-underline flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap font-sans text-[0.83rem] font-medium text-foreground/80 hover:text-foreground transition-colors 2xl:text-sm"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> {t("dashboard")}
              </SpaLink>
            )}
          </nav>

          {/* Right side */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {user ? (
              <>
                <NotificationBell label={t("notifications")} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3">
                      <Avatar className="h-7 w-7 border border-[var(--royal-300)]/30">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} className="object-cover" />}
                        <AvatarFallback className="bg-[var(--royal-100)] text-primary text-xs font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden text-sm font-medium sm:inline">
                        {user.fullName.split(" ").slice(-1)}
                      </span>
                      <Badge variant="outline" className="hidden text-[0.6rem] font-mono lg:inline border-[var(--royal-300)]/30">
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

            <ThemeToggle className="size-11 sm:size-9" />
            <SoundToggle className="size-11 sm:size-9" />
            <LanguageSwitcher />

            {/* Mobile nav */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 sm:size-9 xl:hidden" aria-label={t("menu")}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="glass-strong w-72">
                <SheetHeader>
                  <SheetTitle className="font-display text-foreground">
                    {branding.siteName || "Eleventh Press"}
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  <SpaLink
                    to={{ view: "home" }}
                    onNavigate={() => { setView("home"); setMobileNavOpen(false); }}
                    className="rounded-md px-3 py-2 text-left font-sans text-sm font-medium hover:bg-[var(--royal-100)] transition-colors"
                  >
                    {t("home")}
                  </SpaLink>

                  {/* Publications group */}
                  <p className="mt-2 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("publications")}
                  </p>
                  {PUBLICATIONS_ITEMS.map((item) => (
                    <SpaLink
                      key={item.view}
                      to={{ view: item.view }}
                      onNavigate={() => { setView(item.view); setMobileNavOpen(false); }}
                      className="rounded-md px-3 py-2 pl-5 text-left font-sans text-sm font-medium hover:bg-[var(--royal-100)] transition-colors"
                    >
                      {item.label}
                    </SpaLink>
                  ))}

                  {NAV_ITEMS.filter((item) => item.view !== "home").map((item) => (
                    <SpaLink
                      key={item.view}
                      to={{ view: item.view }}
                      onNavigate={() => { setView(item.view); setMobileNavOpen(false); }}
                      className="rounded-md px-3 py-2 text-left font-sans text-sm font-medium hover:bg-[var(--royal-100)] transition-colors"
                    >
                      {item.label}
                    </SpaLink>
                  ))}
                  {user && (
                    <button
                      onClick={() => { openDashboard("overview"); setMobileNavOpen(false); }}
                      className="rounded-md px-3 py-2 text-left font-sans text-sm font-medium hover:bg-[var(--royal-100)] transition-colors"
                    >
                      {t("dashboard")}
                    </button>
                  )}
                  {!user && (
                    <button
                      onClick={() => { setView("login"); setMobileNavOpen(false); }}
                      className="mt-2 rounded-md bg-primary px-3 py-2 text-left font-sans text-sm font-medium text-primary-foreground"
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
