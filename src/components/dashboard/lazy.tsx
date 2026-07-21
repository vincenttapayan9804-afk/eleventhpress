"use client";

/**
 * Lazy wrappers around the dashboard tabs rendered by
 * src/components/views/dashboard-view.tsx. Only one tab renders at a time
 * (dashboardTab is client-only zustand state, never persisted, always
 * "overview" on a fresh load — see src/lib/store.ts), so statically
 * importing all 18 pulled every tab's full dependency graph into the
 * dashboard bundle regardless of which tab is active. next/dynamic splits
 * each into its own chunk fetched on first visit to that tab. Prop types
 * are inferred from each module's real export, so every existing prop
 * contract is preserved exactly — nothing here changes what any tab
 * receives, only when its code downloads.
 */
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

function TabLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export const OverviewTab = dynamic(() => import("./overview-tab").then((m) => m.OverviewTab), {
  loading: () => <TabLoadingFallback />,
});
export const ExpertDashboardTab = dynamic(() => import("./expert-dashboard-tab").then((m) => m.ExpertDashboardTab), {
  loading: () => <TabLoadingFallback />,
});
export const ProfileTab = dynamic(() => import("./profile-tab").then((m) => m.ProfileTab), {
  loading: () => <TabLoadingFallback />,
});
export const AuthorSubmitTab = dynamic(() => import("./author-submit-tab").then((m) => m.AuthorSubmitTab), {
  loading: () => <TabLoadingFallback />,
});
export const AuthorArticlesTab = dynamic(() => import("./author-articles-tab").then((m) => m.AuthorArticlesTab), {
  loading: () => <TabLoadingFallback />,
});
export const InvoicesTab = dynamic(() => import("./invoices-tab").then((m) => m.InvoicesTab), {
  loading: () => <TabLoadingFallback />,
});
export const EditorQueueTab = dynamic(() => import("./editor-queue-tab").then((m) => m.EditorQueueTab), {
  loading: () => <TabLoadingFallback />,
});
export const ReviewerQueueTab = dynamic(() => import("./reviewer-queue-tab").then((m) => m.ReviewerQueueTab), {
  loading: () => <TabLoadingFallback />,
});
export const ReviewerFormTab = dynamic(() => import("./reviewer-form-tab").then((m) => m.ReviewerFormTab), {
  loading: () => <TabLoadingFallback />,
});
export const IndexingTab = dynamic(() => import("./indexing-tab").then((m) => m.IndexingTab), {
  loading: () => <TabLoadingFallback />,
});
export const CounterTab = dynamic(() => import("./counter-tab").then((m) => m.CounterTab), {
  loading: () => <TabLoadingFallback />,
});
export const InstitutionsTab = dynamic(() => import("./institutions-tab").then((m) => m.InstitutionsTab), {
  loading: () => <TabLoadingFallback />,
});
export const ApplicationTab = dynamic(() => import("./application-tab").then((m) => m.ApplicationTab), {
  loading: () => <TabLoadingFallback />,
});
export const DistributionTab = dynamic(() => import("./distribution-tab").then((m) => m.DistributionTab), {
  loading: () => <TabLoadingFallback />,
});
export const MyBooksTab = dynamic(() => import("./my-books-tab").then((m) => m.MyBooksTab), {
  loading: () => <TabLoadingFallback />,
});
export const BookAcquisitionsTab = dynamic(() => import("./book-acquisitions-tab").then((m) => m.BookAcquisitionsTab), {
  loading: () => <TabLoadingFallback />,
});
export const ReaderTab = dynamic(() => import("./reader-tab").then((m) => m.ReaderTab), {
  loading: () => <TabLoadingFallback />,
});
export const CertificatesTab = dynamic(() => import("./certificates-tab").then((m) => m.CertificatesTab), {
  loading: () => <TabLoadingFallback />,
});
export const AdminTab = dynamic(() => import("./admin-tab").then((m) => m.AdminTab), {
  loading: () => <TabLoadingFallback />,
});
export const ResearchLabTab = dynamic(() => import("./research-lab-tab").then((m) => m.ResearchLabTab), {
  loading: () => <TabLoadingFallback />,
});
