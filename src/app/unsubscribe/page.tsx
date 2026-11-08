import type { Metadata } from "next";
import Link from "next/link";
import { readUnsubscribeToken, CATEGORY_LABELS } from "@/lib/notification-prefs";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

/** Landing page for the unsubscribe link in notification emails. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const parsed = readUnsubscribeToken(token);
  const what = parsed?.category ? `“${CATEGORY_LABELS[parsed.category].label}” emails` : "all notification emails";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="eyebrow">Email preferences</p>
        {parsed ? (
          <>
            <h1 className="mt-3 font-display text-2xl font-semibold">Stop {what}?</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              You&rsquo;ll still see these updates in your dashboard. Security and sign-in emails are always sent.
            </p>
            <UnsubscribeButton token={token} what={what} />
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-2xl font-semibold">This link isn&rsquo;t valid</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              It may have been copied incompletely. You can change every email setting from your dashboard.
            </p>
          </>
        )}
        <Link href="/dashboard/profile#notifications" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Manage all email preferences
        </Link>
      </div>
    </main>
  );
}
