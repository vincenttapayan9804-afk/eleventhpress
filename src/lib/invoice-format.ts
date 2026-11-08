/** Shared labels for invoices and receipts. */
export function invoiceNumber(id: string, createdAt: Date): string {
  return `EP-${createdAt.getFullYear()}-${id.slice(-8).toUpperCase()}`;
}

export function invoiceItemLabel(inv: { type: string; metadata: string | null; article?: { title: string } | null; book?: { title: string } | null }): string {
  let meta: Record<string, string> = {};
  try {
    meta = inv.metadata ? JSON.parse(inv.metadata) : {};
  } catch {
    /* ignore */
  }
  switch (inv.type) {
    case "APC":
      return `Article Processing Charge${inv.article ? ` — “${inv.article.title}”` : ""}`;
    case "SUBSCRIPTION":
      return `Reader subscription${meta.plan ? ` — ${meta.plan.replace(/_/g, " ").toLowerCase()}` : ""}`;
    case "INSTITUTIONAL":
      return "Institutional access";
    case "DISTRIBUTION_PACKAGE":
      return `Distribution package${inv.article ? ` — “${inv.article.title}”` : inv.book ? ` — “${inv.book.title}”` : ""}`;
    default:
      return inv.type.replace(/_/g, " ").toLowerCase();
  }
}
