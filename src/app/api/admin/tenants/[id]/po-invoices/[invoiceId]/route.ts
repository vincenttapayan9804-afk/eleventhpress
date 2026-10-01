import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

const UpdatePoInvoiceSchema = z.object({
  status: z.enum(["PAID", "VOID"]),
});

/**
 * PATCH /api/admin/tenants/[id]/po-invoices/[invoiceId]
 * Marks a PO-billed invoice PAID (once the institution's payment actually
 * clears outside this platform) or VOID (the PO was cancelled/replaced).
 * SUPER_ADMIN-only, same posture as creating one — there is no payment
 * gateway webhook for a PO, so this manual reconciliation step is the
 * only way such an invoice ever leaves OPEN.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, invoiceId } = await params;
  const parsed = await parseBody(req, UpdatePoInvoiceSchema);
  if (!parsed.ok) return parsed.response;

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.tenantId !== id || invoice.billingMethod !== "PO") {
    return NextResponse.json({ error: "PO invoice not found" }, { status: 404 });
  }

  const updated = await db.invoice.update({
    where: { id: invoiceId },
    data: {
      status: parsed.data.status,
      paidAt: parsed.data.status === "PAID" ? new Date() : invoice.paidAt,
    },
  });

  await db.auditLog.create({
    data: {
      userId: auth.session.userId,
      action: parsed.data.status === "PAID" ? "PO_INVOICE_PAID" : "PO_INVOICE_VOIDED",
      entityType: "INVOICE",
      entityId: invoiceId,
      metadata: JSON.stringify({ tenantId: id }),
    },
  });

  return NextResponse.json({ invoice: updated });
}
