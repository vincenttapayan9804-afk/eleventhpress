import type { Metadata } from "next";
import { db } from "@/lib/db";
import { findConfirmation } from "@/lib/authorship";
import { parseAuthors } from "@/lib/article";
import { ConfirmAuthorshipForm } from "./confirm-form";

export const metadata: Metadata = { title: "Confirm authorship", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Landing page for the co-author confirmation email (src/lib/authorship.ts). */
export default async function ConfirmAuthorshipPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const row = await findConfirmation(token).catch(() => null);
  const article = row
    ? await db.article.findUnique({ where: { id: row.articleId }, select: { title: true, authors: true, discipline: true, submittedAt: true } })
    : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="eyebrow">Authorship confirmation</p>
        {!row || !article ? (
          <>
            <h1 className="mt-3 font-display text-2xl font-semibold">This link isn&rsquo;t valid</h1>
            <p className="mt-3 text-sm text-muted-foreground">It may have been copied incompletely. Please use the full link from the email.</p>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-2xl font-semibold leading-snug">{article.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {article.discipline}
              {article.submittedAt ? ` · submitted ${article.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}
            </p>
            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Listed authors</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {parseAuthors(article.authors).map((a, i) => (
                  <li key={i} className={a.name === row.name ? "font-semibold" : ""}>
                    {a.name}
                    {a.affiliation ? <span className="text-muted-foreground"> — {a.affiliation}</span> : null}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your contribution (CRediT)</p>
              <p className="mt-1 text-sm">{row.creditRoles.length ? row.creditRoles.join(", ") : "No roles were specified."}</p>
            </div>
            <ConfirmAuthorshipForm token={token} name={row.name} initialStatus={row.status} />
          </>
        )}
      </div>
    </main>
  );
}
