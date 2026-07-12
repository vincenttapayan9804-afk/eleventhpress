"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewKey =
  | "home"
  | "browse"
  | "article"
  | "about"
  | "login"
  | "register"
  | "dashboard"
  | "resources"
  | "authors"
  | "faqs"
  | "adminPortal";

export type DashboardTab =
  | "overview"
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
  | "admin";

interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
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

  // Auth
  token: string | null;
  user: SessionUser | null;
  setAuth: (token: string, user: SessionUser) => void;
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

      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () =>
        set({
          token: null,
          user: null,
          view: "home",
          dashboardTab: "overview",
        }),

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
      partialize: (s) => ({ token: s.token, user: s.user, locale: s.locale }) as any,
    }
  )
);
