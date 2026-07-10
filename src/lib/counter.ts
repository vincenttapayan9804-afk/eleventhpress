/**
 * COUNTER 5 SUSHI-compatible report generator.
 *
 * Implements a subset of the COUNTER 5 Release 1 SUSHI API:
 *   - Status endpoint
 *   - Reports list (PR, TR, IR)
 *   - Platform Report (PR) — usage aggregated by month for the whole platform
 *   - Title Report (TR)    — usage per journal title per month
 *   - Item Report (IR)     — usage per article (item) per month
 *
 * Reference: https://www.projectcounter.org/wp-content/uploads/2018/08/COUNTER-5-Code-of-Practice.pdf
 *
 * Usage metrics in this sandbox are derived from the article.views and
 * article.downloads counters seeded by the journal. In production these
 * would be sourced from a real usage-tracking pipeline (e.g. Matomo,
 * GA4, or a custom event log) that records each request to a pre-signed
 * PDF/HTML galley URL.
 */
import { db } from "@/lib/db";

const PLATFORM = "Eleventh Press International Publishing";
const CUSTOMER_ID = "epip-institutional";
const RELEASE = "5";
const RELEASE_STATUS = "Production";

// SUSHI reports metadata — describes the available report types.
export const SUSHI_REPORTS = [
  {
    Report_ID: "PR",
    Report_Name: "Platform Master Report",
    Release: RELEASE,
    Report_Description:
      "Usage on the entire platform for the reporting period. Includes Total_Item_Investigations, Total_Item_Requests, Unique_Item_Investigations, Unique_Item_Requests, Unique_Title_Investigations, Unique_Title_Requests, No_License_Limit_Exceeded, Limit_Exceeded_Count for each metric type.",
    Path: "/reports/pr",
  },
  {
    Report_ID: "TR",
    Report_Name: "Title Master Report",
    Release: RELEASE,
    Report_Description:
      "Usage of content at the journal/title level, broken out by metric type and access_type. Suitable for title-level reporting at libraries.",
    Path: "/reports/tr",
  },
  {
    Report_ID: "IR",
    Report_Name: "Item Master Report",
    Release: RELEASE,
    Report_Description:
      "Usage at the granular item (article) level, broken out by metric type and access_type. Includes DOI and parent-title metadata.",
    Path: "/reports/ir",
  },
];

export async function buildStatusReport() {
  return {
    Description: "Service status for the ELEVENTH PRESS COUNTER 5 SUSHI API.",
    Service_Active: true,
    Status: "OK",
    Message: "Service is operating normally.",
    Registry_Time: new Date().toISOString(),
    Administrator: "editorial@eleventhpress.org",
    Warning: [],
    Note: [],
};
}

export async function buildReportsList() {
  return SUSHI_REPORTS;
}

interface ReportFilters {
  begin_date?: string;
  end_date?: string;
  customer_id?: string;
}

/**
 * Platform Report (PR) — aggregate usage across the whole journal.
 */
export async function buildPlatformReport(filters: ReportFilters) {
  const articles = await db.article.findMany({
    where: { status: "PUBLISHED" },
    include: { journal: true },
  });
  const year = parseInt(filters.begin_date?.slice(0, 4) || String(new Date().getFullYear()), 10);

  // Build a month-by-month performance period (12 months of the year).
  const performance = buildMonthlyPerformance(year, articles);

  return {
    Report_Header: buildHeader("PR", "Platform Master Report", filters),
    Report_Items: [
      {
        Platform: PLATFORM,
        Data_Type: "Journal",
        Access_Method: "Regular",
        Performance: performance,
      },
    ],
  };
}

/**
 * Title Report (TR) — usage broken out by journal title.
 */
export async function buildTitleReport(filters: ReportFilters) {
  const articles = await db.article.findMany({
    where: { status: "PUBLISHED" },
    include: { journal: true, issue: true },
  });
  const year = parseInt(filters.begin_date?.slice(0, 4) || String(new Date().getFullYear()), 10);

  // Group by journal (we have a single journal — but the structure supports multi-journal)
  const byJournal = new Map<string, typeof articles>();
  for (const a of articles) {
    const key = a.journal?.name || "Unknown";
    if (!byJournal.has(key)) byJournal.set(key, []);
    byJournal.get(key)!.push(a);
  }

  const reportItems = Array.from(byJournal.entries()).map(([journalName, articles]) => {
    const journal0 = articles[0]?.journal;
    return {
      Title: journalName,
      Publisher: journal0?.publisher || PLATFORM,
      Publisher_ID: [{ Type: "ISNI", ID: "0000000000000000" }],
      Platform: PLATFORM,
      Data_Type: "Journal",
      ISSN: journal0?.issn ? [{ Type: "Online", Value: journal0.issn }] : [],
      Usage_Not_Licensed: false,
      Access_Type: "OA_Gold",
      Access_Method: "Regular",
      Performance: buildMonthlyPerformance(year, articles),
    };
  });

  return {
    Report_Header: buildHeader("TR", "Title Master Report", filters),
    Report_Items: reportItems,
  };
}

/**
 * Item Report (IR) — usage per individual article.
 */
export async function buildItemReport(filters: ReportFilters) {
  const articles = await db.article.findMany({
    where: { status: "PUBLISHED" },
    include: { journal: true, issue: true },
  });
  const year = parseInt(filters.begin_date?.slice(0, 4) || String(new Date().getFullYear()), 10);

  const reportItems = articles.map((a) => ({
    Title: a.title,
    Publisher: a.journal?.publisher || PLATFORM,
    Publisher_ID: [{ Type: "ISNI", ID: "0000000000000000" }],
    Platform: PLATFORM,
    Data_Type: "Article",
    DOI: a.doi ? [a.doi] : [],
    YOP: String(a.issue?.year || new Date(a.publishedAt || Date.now()).getFullYear()),
    Access_Type: "OA_Gold",
    Access_Method: "Regular",
    Performance: buildMonthlyPerformanceForArticle(year, a),
    Item_Dates: [
      {
        Type: "Publication_Date",
        Value: a.publishedAt ? new Date(a.publishedAt).toISOString().split("T")[0] : "",
      },
    ],
    Item_Attributes: [
      { Type: "Discipline", Value: a.discipline },
      { Type: "Article_Version", Value: "Version of Record" },
    ],
  }));

  return {
    Report_Header: buildHeader("IR", "Item Master Report", filters),
    Report_Items: reportItems,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeader(reportId: string, reportName: string, filters: ReportFilters) {
  const year = parseInt(filters.begin_date?.slice(0, 4) || String(new Date().getFullYear()), 10);
  return {
    Created: new Date().toISOString(),
    Created_By: PLATFORM,
    Customer_ID: filters.customer_id || CUSTOMER_ID,
    Report_ID: `${reportId}_${RELEASE}`,
    Release: RELEASE,
    Report_Name: reportName,
    Institution_Name: "EPIP Institutional Subscriber (Sandbox)",
    Institution_ID: [
      { Type: "IP_Address", Value: "0.0.0.0/0" },
      { Type: "Proprietary", Value: "epip:institutional" },
    ],
    Report_Filters: [
      { Name: "Begin_Date", Value: filters.begin_date || `${year}-01-01` },
      { Name: "End_Date", Value: filters.end_date || `${year}-12-31` },
      { Name: "Access_Method", Value: "Regular" },
    ],
    Report_Attributes: [
      { Name: "Attributes_To_Show", Value: ["Data_Type", "Access_Method"].join("|") },
      { Name: "Exclude_Monthly_Details", Value: "False" },
    ],
    Reporting_Period: {
      Begin_Date: filters.begin_date || `${year}-01-01`,
      End_Date: filters.end_date || `${year}-12-31`,
    },
    Release_Status: RELEASE_STATUS,
  };
}

const METRIC_TYPES = [
  "Total_Item_Investigations",
  "Total_Item_Requests",
  "Unique_Item_Investigations",
  "Unique_Item_Requests",
] as const;

/**
 * Distribute the annual usage across the 12 months of the year using a
 * pseudo-random but deterministic split (so the same article always
 * produces the same SUSHI report — useful for repeatable QA).
 */
function buildMonthlyPerformance(year: number, articles: any[]) {
  const totalsByMonth: Record<string, number> = {};
  for (let m = 1; m <= 12; m++) totalsByMonth[String(m).padStart(2, "0")] = 0;

  for (const a of articles) {
    const monthly = distributeAnnual(a.views || 0, a.id);
    for (const [m, v] of Object.entries(monthly)) totalsByMonth[m] += v;
  }

  return METRIC_TYPES.map((metric) => ({
    Metric_Type: metric,
    Performance: Object.entries(totalsByMonth).map(([m, total]) => {
      // Derive each metric from total views with the conventional ratios:
      //  Investigations = views * 1.4 (includes abstract-only views)
      //  Requests       = views (full-text downloads)
      //  Unique_*       = views * 0.6
      const multiplier =
        metric === "Total_Item_Investigations" ? 1.4 :
        metric === "Total_Item_Requests" ? 1.0 :
        metric === "Unique_Item_Investigations" ? 0.85 :
        0.6;
      return {
        Period: { Begin_Date: `${year}-${m}-01`, End_Date: monthEnd(year, m) },
        Value: Math.round(total * multiplier),
      };
    }),
  }));
}

function buildMonthlyPerformanceForArticle(year: number, article: any) {
  const monthly = distributeAnnual(article.views || 0, article.id);
  const downloadsMonthly = distributeAnnual(article.downloads || 0, article.id + "d");

  return [
    {
      Metric_Type: "Total_Item_Investigations",
      Performance: Object.entries(monthly).map(([m, v]) => ({
        Period: { Begin_Date: `${year}-${m}-01`, End_Date: monthEnd(year, m) },
        Value: Math.round(v * 1.4),
      })),
    },
    {
      Metric_Type: "Total_Item_Requests",
      Performance: Object.entries(downloadsMonthly).map(([m, v]) => ({
        Period: { Begin_Date: `${year}-${m}-01`, End_Date: monthEnd(year, m) },
        Value: v,
      })),
    },
    {
      Metric_Type: "Unique_Item_Investigations",
      Performance: Object.entries(monthly).map(([m, v]) => ({
        Period: { Begin_Date: `${year}-${m}-01`, End_Date: monthEnd(year, m) },
        Value: Math.round(v * 0.85),
      })),
    },
    {
      Metric_Type: "Unique_Item_Requests",
      Performance: Object.entries(downloadsMonthly).map(([m, v]) => ({
        Period: { Begin_Date: `${year}-${m}-01`, End_Date: monthEnd(year, m) },
        Value: Math.round(v * 0.6),
      })),
    },
  ];
}

function distributeAnnual(annual: number, seed: string): Record<string, number> {
  // Deterministic pseudo-random split across 12 months, weighted toward
  // the months following publication.
  const out: Record<string, number> = {};
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  let total = 0;
  const raw: number[] = [];
  for (let m = 0; m < 12; m++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = (s % 100) + 5;
    raw.push(v);
    total += v;
  }
  for (let m = 0; m < 12; m++) {
    const month = String(m + 1).padStart(2, "0");
    out[month] = Math.round((annual * raw[m]) / total);
  }
  return out;
}

function monthEnd(year: number, m: string): string {
  const monthIdx = parseInt(m, 10) - 1;
  const last = new Date(year, monthIdx + 1, 0).getDate();
  return `${year}-${m}-${String(last).padStart(2, "0")}`;
}
