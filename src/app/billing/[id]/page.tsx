import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { JOURNAL_IDENTITY } from "@/lib/site";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { invoiceItemLabel, invoiceNumber } from "@/lib/invoice-format";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const money = (n: number, c: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(n);
const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * GET /billing/[id] — a printable invoice (open) or receipt (paid) for the
 * signed-in owner, or a super admin. Save as PDF from the print dialog.
 */
export default async function BillingDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await headers();
  const session = getSessionFromHeaders(h);
  if (!session) notFound();
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { user: { select: { fullName: true, email: true, affiliation: true, country: true } }, article: { select: { title: true } }, book: { select: { title: true } } },
  });
  if (!inv || (inv.userId !== session.userId && session.role !== "SUPER_ADMIN")) notFound();
  const tenant = await resolveTenantFromHeaders(h).catch(() => null);
  const issuer = tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : JOURNAL_IDENTITY.name;
  const paid = inv.status === "PAID";
  const title = paid ? "Receipt" : inv.status === "OPEN" ? "Invoice" : `Invoice (${inv.status.toLowerCase()})`;

  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-10 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-between print:hidden">
        <a href="/dashboard/invoices" className="text-sm font-medium text-primary hover:underline">← Billing &amp; invoices</a>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-3xl rounded-2xl border border-border bg-white p-10 text-[#1a1622] shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#e7e2ef] pb-8">
          <div>
            <p className="font-display text-xl font-semibold">{issuer}</p>
            <p className="mt-1 text-sm text-[#6b6478]">{JOURNAL_IDENTITY.location}</p>
            <p className="text-sm text-[#6b6478]">{JOURNAL_IDENTITY.editorialEmail}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold tracking-tight">{title}</p>
            <p className="mt-1 font-mono text-sm text-[#6b6478]">{invoiceNumber(inv.id, inv.createdAt)}</p>
            {paid && <p className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Paid</p>}
          </div>
        </header>

        <section className="grid gap-6 py-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8a7aa0]">Billed to</p>
            <p className="mt-2 font-medium">{inv.user.fullName}</p>
            {inv.user.affiliation && <p className="text-sm text-[#6b6478]">{inv.user.affiliation}</p>}
            <p className="text-sm text-[#6b6478]">{inv.user.email}</p>
            {inv.user.country && <p className="text-sm text-[#6b6478]">{inv.user.country}</p>}
            {inv.poNumber && <p className="mt-2 text-sm">PO number: {inv.poNumber}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm sm:justify-self-end">
            <dt className="text-[#8a7aa0]">Issued</dt>
            <dd>{date(inv.createdAt)}</dd>
            {paid && inv.paidAt && (
              <>
                <dt className="text-[#8a7aa0]">Paid</dt>
                <dd>{date(inv.paidAt)}</dd>
              </>
            )}
            {inv.provider && (
              <>
                <dt className="text-[#8a7aa0]">Method</dt>
                <dd className="capitalize">{inv.provider}</dd>
              </>
            )}
            {paid && inv.stripeInvoiceId && (
              <>
                <dt className="text-[#8a7aa0]">Reference</dt>
                <dd className="max-w-[16rem] truncate font-mono text-xs">{inv.stripeInvoiceId}</dd>
              </>
            )}
          </dl>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e7e2ef] text-left text-xs uppercase tracking-wider text-[#8a7aa0]">
              <th className="pb-3 font-semibold">Description</th>
              <th className="pb-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#e7e2ef]">
              <td className="py-4 pr-6">{invoiceItemLabel(inv)}</td>
              <td className="py-4 text-right tabular-nums">{money(inv.amount, inv.currency)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-5 text-right font-medium">{paid ? "Total paid" : "Total due"}</td>
              <td className="pt-5 text-right font-display text-2xl font-semibold tabular-nums">{money(inv.amount, inv.currency)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="mt-12 border-t border-[#e7e2ef] pt-6 text-xs leading-relaxed text-[#8a7aa0]">
          {paid
            ? "Thank you. This receipt confirms payment in full; keep it for your records or funder reporting."
            : "Pay securely from your dashboard under Billing & invoices. Questions about this invoice or a waiver? Reply to the editorial office."}
        </footer>
      </article>
    </main>
  );
}
