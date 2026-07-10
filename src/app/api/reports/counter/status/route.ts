import { buildStatusReport } from "@/lib/counter";

/** GET /api/reports/counter/status — SUSHI Service Status */
export async function GET() {
  const status = await buildStatusReport();
  return Response.json(status);
}
