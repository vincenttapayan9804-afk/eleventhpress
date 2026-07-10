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
  | "dashboard";

export type DashboardTab =
  | "overview"
  | "submit"
  | "myArticles"
  | "invoices"
  | "editorQueue"
  | "reviewerQueue"
  | "reviewerForm"
  | "indexing"
  | "counter"
  | "reader"
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
}

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
    }),
    {
      name: "epip-session",
      partialize: (s) => ({ token: s.token, user: s.user }) as any,
    }
  )
);
