import { NextRequest } from "next/server";
import {
  buildPlatformReport,
  buildTitleReport,
  buildItemReport,
} from "@/lib/counter";
import { verifySushiApiKey } from "@/lib/institutions";

/**
 * GET /api/reports/counter/reports/[reportId]
 *
 * Returns a COUNTER 5 SUSHI report. Supported IDs: pr, tr, ir.
 * Query params: begin_date=YYYY-MM-DD, end_date=YYYY-MM-DD, customer_id=...,
 * api_key=... (required whenever customer_id is a real institution — see
 * verifySushiApiKey() in src/lib/institutions.ts).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId: rawId } = await params;
  const reportId = rawId.toUpperCase();

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customer_id") || undefined;

  if (customerId) {
    const authorized = await verifySushiApiKey(customerId, searchParams.get("api_key"));
    if (!authorized) {
      return Response.json(
        {
          Code: 4030,
          Severity: "Error",
          Message: "Invalid or missing api_key for this customer_id",
          Data: null,
        },
        { status: 403 }
      );
    }
  }

  const filters = {
    begin_date: searchParams.get("begin_date") || `${new Date().getFullYear()}-01-01`,
    end_date: searchParams.get("end_date") || `${new Date().getFullYear()}-12-31`,
    customer_id: customerId,
  };

  let report;
  switch (reportId) {
    case "PR":
      report = await buildPlatformReport(filters);
      break;
    case "TR":
      report = await buildTitleReport(filters);
      break;
    case "IR":
      report = await buildItemReport(filters);
      break;
    default:
      return Response.json(
        {
          Code: 4000,
          Severity: "Error",
          Message: `Unknown report ID: ${reportId}. Supported: PR, TR, IR.`,
          Data: null,
        },
        { status: 404 }
      );
  }

  return Response.json(report);
}
