import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">This page isn&rsquo;t here</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The link may be out of date, or the page may have moved. Try the articles, or start again from the home page.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Home
        </Link>
        <Link href="/articles" className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted">
          Browse articles
        </Link>
        <Link href="/faqs" className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted">
          Help &amp; FAQs
        </Link>
      </div>
    </main>
  );
}
