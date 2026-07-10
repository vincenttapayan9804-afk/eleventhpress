import { buildReportsList } from "@/lib/counter";

/** GET /api/reports/counter/reports — list of supported COUNTER 5 reports */
export async function GET() {
  const reports = await buildReportsList();
  return Response.json(reports);
}
