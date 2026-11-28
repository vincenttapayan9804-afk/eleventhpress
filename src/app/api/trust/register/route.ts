import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicRegister } from "@/lib/compliance";
import { publicSubprocessors } from "@/lib/compliance-records";

/**
 * GET /api/trust/register
 * Public. The Trust page's policy register: titles and dates of the policies
 * the owner has adopted and chosen to list. Never returns a draft, a retired
 * policy, a policy's text, or anything about devices.
 */
export const revalidate = 300;

export async function GET() {
  try {
    const rows = await db.compliancePolicy.findMany({ where: { status: "ADOPTED", isPublic: true } });
    // The records table may not exist yet on a fresh deploy: the policy list must still load.
    const suppliers = await db.complianceRecord.findMany({ where: { kind: "SUPPLIER", status: "ACTIVE", isPublic: true } }).catch(() => []);
    return NextResponse.json({ policies: publicRegister(rows, new Date()), subprocessors: publicSubprocessors(suppliers) }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    // Before the tables exist (a fresh deploy), show nothing rather than fail, but leave a trace.
    console.error("[trust/register] could not read the policy register", e);
    return NextResponse.json({ policies: [], subprocessors: [] });
  }
}
