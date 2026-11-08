import type { Metadata } from "next";

export const metadata: Metadata = { title: "You're offline", robots: { index: false, follow: false } };

/** Shown by the service worker (public/sw.js) when a page isn't available offline. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md">
        <p className="eyebrow">Offline</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">You&rsquo;re not connected</h1>
        <p className="mt-3 text-muted-foreground">
          This page isn&rsquo;t saved on this device. Articles you&rsquo;ve opened or saved to your library are still available — go back and open
          one of those, or try again once you&rsquo;re online.
        </p>
        <a href="/" className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Try again</a>
      </div>
    </main>
  );
}
