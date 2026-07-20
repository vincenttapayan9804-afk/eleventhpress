"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch } from "./api-client";

export type ViewKey =
  | "home"
  | "browse"
  | "article"
  | "about"
  | "login"
  | "register"
  | "dashboard"
  | "resources"
  | "collections"
  | "authors"
  | "experts"
  | "charter"
  | "faqs"
  | "policies"
  | "privacy"
  | "accessibility"
  | "adminPortal";

export type DashboardTab =
  | "overview"
  | "expertDashboard"
  | "profile"
  | "submit"
  | "myArticles"
  | "invoices"
  | "editorQueue"
  | "reviewerQueue"
  | "reviewerForm"
  | "indexing"
  | "counter"
  | "institutions"
  | "reader"
  | "application"
  | "distribution"
  | "myBooks"
  | "bookAcquisitions"
  | "certificates"
  | "admin";

interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  // Only meaningful when role === "EXPERT" — see prisma/schema.prisma's
  // User.expertTier comment. CONTRIBUTOR | COUNCIL_MEMBER | null.
  expertTier?: string | null;
  affiliation?: string | null;
  expertise?: string | null;
  country?: string | null;
  orcid?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

export type Locale = "en" | "es" | "fr" | "fil" | "zh-Hans";

interface AppState {
  // View routing (single-page)
  view: ViewKey;
  articleId: string | null;
  dashboardTab: DashboardTab;
  reviewId: string | null;
  setView: (v: ViewKey) => void;
  openArticle: (id: string) => void;
  openDashboard: (tab?: DashboardTab) => void;
  openReviewerForm: (reviewId: string) => void;

  // Auth — the session itself lives in an httpOnly cookie the browser
  // manages; `user` here is only the non-secret profile info the UI needs
  // to render (name/role/etc.), never the session token.
  user: SessionUser | null;
  setAuth: (user: SessionUser) => void;
  logout: () => void;

  // UI
  authSheetOpen: boolean;
  setAuthSheetOpen: (v: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;

  // Admin portal gate
  adminVerified: boolean;
  setAdminVerified: (v: boolean) => void;
  openAdminPortal: () => void;

  // i18n
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      view: "home",
      articleId: null,
      dashboardTab: "overview",
      reviewId: null,
      setView: (v) => set({ view: v }),
      openArticle: (id) => set({ view: "article", articleId: id }),
      openDashboard: (tab = "overview") =>
        set({ view: "dashboard", dashboardTab: tab }),
      openReviewerForm: (reviewId) =>
        set({ view: "dashboard", dashboardTab: "reviewerForm", reviewId }),

      user: null,
      setAuth: (user) => set({ user }),
      logout: () => {
        // Fire-and-forget: clears the httpOnly session cookie server-side
        // (client JS can't touch it directly). Local state clears
        // immediately regardless of whether this call succeeds. Uses
        // apiFetch (not a raw fetch) so the CSRF header is attached —
        // middleware.ts requires it on every mutating request now.
        apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        set({
          user: null,
          view: "home",
          dashboardTab: "overview",
        });
      },

      authSheetOpen: false,
      setAuthSheetOpen: (v) => set({ authSheetOpen: v }),
      mobileNavOpen: false,
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),

      adminVerified: false,
      setAdminVerified: (v) => set({ adminVerified: v }),
      openAdminPortal: () => set({ view: "adminPortal" }),

      locale: "en",
      setLocale: (l) => set({ locale: l }),
    }),
    {
      name: "epip-session",
      partialize: (s) => ({ user: s.user, locale: s.locale }) as any,
    }
  )
);
