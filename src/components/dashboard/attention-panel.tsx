"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileWarning, Gavel, Inbox, Receipt, PenSquare } from "lucide-react";
import { useApp, type DashboardTab } from "@/lib/store";

interface Item {
  key: string;
  icon: typeof Inbox;
  tone: "urgent" | "normal";
  title: string;
  detail: string;
  open: () => void;
}

const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"];
const DAY = 86400000;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * Top of the dashboard overview: "what needs you now" for the signed-in
 * role, built from the dashboard data already loaded — invitations to
 * answer, reviews due, revisions to submit, invoices to pay, submissions
 * to screen, decisions to make, overdue reviewers to chase.
 */
export function AttentionPanel({ data }: { data: any }) {
  const role = useApp((s) => s.user?.role) || "";
  const openDashboard = useApp((s) => s.openDashboard);
  const openReviewerForm = useApp((s) => s.openReviewerForm);
  const go = (tab: DashboardTab) => () => openDashboard(tab);
  const now = Date.now();
  const items: Item[] = [];

  // Reviewer
  const reviews: any[] = data?.reviews ?? [];
  const invited = reviews.filter((r) => r.status === "INVITED");
  if (invited.length) {
    items.push({
      key: "invited",
      icon: Inbox,
      tone: "normal",
      title: `Respond to ${plural(invited.length, "review invitation")}`,
      detail: invited.length === 1 ? invited[0].article?.title ?? "" : "Accept or decline so the editor can plan",
      open: go("reviewerQueue"),
    });
  }
  for (const r of reviews.filter((x) => ["ACCEPTED", "IN_PROGRESS"].includes(x.status) && x.dueDate)) {
    const days = Math.ceil((new Date(r.dueDate).getTime() - now) / DAY);
    if (days > 7) continue;
    items.push({
      key: `due-${r.id}`,
      icon: days < 0 ? AlertTriangle : PenSquare,
      tone: days < 0 ? "urgent" : "normal",
      title: days < 0 ? `Review overdue by ${plural(-days, "day")}` : days === 0 ? "Review due today" : `Review due in ${plural(days, "day")}`,
      detail: r.article?.title ?? "",
      open: () => openReviewerForm(r.id),
    });
  }

  // Author
  const submissions: any[] = data?.submissions ?? [];
  for (const s of submissions.filter((x) => x.status === "REVISIONS_REQUIRED")) {
    items.push({ key: `rev-${s.id}`, icon: FileWarning, tone: "urgent", title: "Revisions requested", detail: s.title, open: go("myArticles") });
  }
  const openInvoices = (data?.invoices ?? []).filter((i: any) => i.status === "OPEN");
  if (openInvoices.length) {
    items.push({
      key: "invoices",
      icon: Receipt,
      tone: "normal",
      title: `Pay ${plural(openInvoices.length, "open invoice")}`,
      detail: "Production starts once the publication charge is settled",
      open: go("invoices"),
    });
  }

  // Editor
  if (EDITOR_ROLES.includes(role)) {
    const queue: any[] = data?.queue ?? [];
    const toScreen = queue.filter((a) => a.status === "SUBMITTED");
    if (toScreen.length) {
      items.push({ key: "screen", icon: Inbox, tone: "normal", title: `Screen ${plural(toScreen.length, "new submission")}`, detail: toScreen[0].title, open: go("editorQueue") });
    }
    const readyForDecision = queue.filter(
      (a) => a.status === "UNDER_REVIEW" && (a.reviews ?? []).length > 0 && (a.reviews ?? []).filter((r: any) => r.status !== "DECLINED").every((r: any) => r.status === "COMPLETED")
    );
    if (readyForDecision.length) {
      items.push({
        key: "decide",
        icon: Gavel,
        tone: "urgent",
        title: `Make a decision on ${plural(readyForDecision.length, "manuscript")}`,
        detail: "All reviews are in",
        open: go("editorQueue"),
      });
    }
    const overdue = queue.flatMap((a) => (a.reviews ?? []).filter((r: any) => ["ACCEPTED", "IN_PROGRESS"].includes(r.status) && r.dueDate && new Date(r.dueDate).getTime() < now));
    if (overdue.length) {
      items.push({ key: "overdue", icon: Clock3, tone: "urgent", title: `${plural(overdue.length, "review")} overdue`, detail: "Reviewers have been reminded — consider a replacement", open: go("editorQueue") });
    }
    const noReviewers = queue.filter((a) => a.status === "UNDER_REVIEW" && (a.reviews ?? []).filter((r: any) => r.status !== "DECLINED").length === 0);
    if (noReviewers.length) {
      items.push({ key: "assign", icon: Inbox, tone: "normal", title: `Invite reviewers for ${plural(noReviewers.length, "manuscript")}`, detail: noReviewers[0].title, open: go("editorQueue") });
    }
  }

  const relevant = reviews.length || submissions.length || EDITOR_ROLES.includes(role) || openInvoices.length;
  if (!relevant) return null;

  items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "urgent" ? -1 : 1));

  return (
    <section aria-labelledby="attention-heading" className="mb-5 rounded-xl border border-border bg-card/80 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 id="attention-heading" className="font-display text-lg font-semibold">Needs your attention</h2>
        {items.length > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> You&rsquo;re all caught up.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.slice(0, 8).map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.key}>
                <button type="button" onClick={it.open} className="group flex w-full items-center gap-3 py-3 text-left">
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      it.tone === "urgent" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{it.title}</span>
                    {it.detail && <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
