import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireTenantScope } from "@/lib/tenant-auth";
import { TENANT_SCOPED_ADMIN_ROLES } from "@/lib/roles";
import { parseBody } from "@/lib/validate";

/**
 * GET /api/admin/tenants/[id]/po-invoices
 * Lists this tenant's purchase-order-billed invoices (billingMethod "PO")
 * — an enterprise contract settled outside the card/gateway flow, newest
 * first. Readable by the tenant's own TENANT_ADMIN or any SUPER_ADMIN,
 * same scope as GET/PATCH /api/admin/tenants/[id] itself.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireTenantScope(req.headers, id, TENANT_SCOPED_ADMIN_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const invoices = await db.invoice.findMany({
    where: { tenantId: id, billingMethod: "PO" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ invoices });
}

const CreatePoInvoiceSchema = z.object({
  poNumber: z.string().trim().min(1).max(100),
});

/**
 * POST /api/admin/tenants/[id]/po-invoices
 * Generates a new PO-billed Invoice for this tenant's contracted
 * Tenant.pricePerYear, attributed to Tenant.billingOwnerId — the exact
 * linkage Commercial Layer Phase 0 deliberately left unbuilt (see
 * Tenant.pricePerYear's schema comment). SUPER_ADMIN-only: generating a
 * real financial record is a platform-level billing action, same posture
 * PATCH /api/admin/tenants/[id] already applies to pricePerYear/
 * billingOwnerId themselves. Requires both to already be set — there is
 * no sane amount or payer to bill otherwise.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = await parseBody(req, CreatePoInvoiceSchema);
  if (!parsed.ok) return parsed.response;

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.pricePerYear == null) {
    return NextResponse.json({ error: "Set a price per year for this tenant before generating a PO invoice" }, { status: 400 });
  }
  if (!tenant.billingOwnerId) {
    return NextResponse.json({ error: "Set a billing owner for this tenant before generating a PO invoice" }, { status: 400 });
  }

  const invoice = await db.invoice.create({
    data: {
      userId: tenant.billingOwnerId,
      tenantId: tenant.id,
      type: "INSTITUTIONAL",
      amount: Number(tenant.pricePerYear),
      currency: "USD",
      status: "OPEN",
      billingMethod: "PO",
      poNumber: parsed.data.poNumber,
      metadata: JSON.stringify({ plan: tenant.plan, tenantName: tenant.name }),
    },
  });

  await db.auditLog.create({
    data: {
      userId: auth.session.userId,
      action: "PO_INVOICE_CREATED",
      entityType: "INVOICE",
      entityId: invoice.id,
      metadata: JSON.stringify({ tenantId: tenant.id, amount: invoice.amount, poNumber: invoice.poNumber }),
    },
  });

  return NextResponse.json({ invoice });
}
