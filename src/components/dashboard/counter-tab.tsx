"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Download,
  ExternalLink,
  Server,
  FileText,
  Database,
  RefreshCw,
  Loader2,
} from "lucide-react";

type ReportId = "PR" | "TR" | "IR";

export function CounterTab() {
  const [status, setStatus] = useState<any>(null);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<ReportId>("PR");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        apiFetch<any>("/api/reports/counter/status"),
        apiFetch<any[]>("/api/reports/counter/reports"),
      ]);
      setStatus(s);
      setReportsList(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadReport(id: ReportId) {
    setReportLoading(true);
    setReportData(null);
    try {
      const data = await apiFetch<any>(
        `/api/reports/counter/reports/${id}?begin_date=${year}-01-01&end_date=${year}-12-31`
      );
      setReportData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadReport(activeReport);
  }, [activeReport, year]);

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <Card className="paper-card bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Server className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-display text-base font-semibold">COUNTER 5 SUSHI service</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This endpoint exposes COUNTER 5 compliant usage statistics. Libraries
                  and institutional subscribers can harvest these reports via the standard
                  SUSHI protocol using their favourite client (e.g. JScholar, AlbaziQ, OpenURL).
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {status && (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                      <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {status.Status || "OK"}
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-mono text-[0.6rem]">Release 5</Badge>
                  <a
                    href="/api/reports/counter"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> SUSHI root
                  </a>
                  <a
                    href="/api/reports/counter/status"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Status
                  </a>
                  <a
                    href="/api/reports/counter/reports"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Reports list
                  </a>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports tabs */}
      <Tabs value={activeReport} onValueChange={(v) => setActiveReport(v as ReportId)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <TabsList className="flex w-full max-w-md items-center gap-1 overflow-x-auto [&>*]:shrink-0">
            <TabsTrigger value="PR">
              <Database className="mr-1.5 h-3.5 w-3.5" /> PR · Platform
            </TabsTrigger>
            <TabsTrigger value="TR">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> TR · Title
            </TabsTrigger>
            <TabsTrigger value="IR">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> IR · Item
            </TabsTrigger>
          </TabsList>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Reporting year</label>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
              <SelectTrigger className="h-9 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2026, 2025, 2024, 2023, 2022, 2021].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={activeReport} className="mt-4">
          <Card className="paper-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">{activeReport === "PR" ? "Platform Master Report" : activeReport === "TR" ? "Title Master Report" : "Item Master Report"}</p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    {reportsList.find((r) => r.Report_ID === activeReport)?.Report_Name || activeReport}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href={`/api/reports/counter/reports/${activeReport}?begin_date=${year}-01-01&end_date=${year}-12-31`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Raw JSON
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : reportData ? (
                <CounterReportView report={reportData} reportId={activeReport} year={year} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Failed to load report.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reports metadata */}
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <p className="eyebrow">Available reports</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {reportsList.map((r) => (
              <div key={r.Report_ID} className="rounded-md border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[0.65rem]">{r.Report_ID}_{r.Release}</Badge>
                  <a
                    href={`/api/reports/counter${r.Path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-[0.65rem] text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> open
                  </a>
                </div>
                <p className="mt-2 font-display text-sm font-semibold">{r.Report_Name}</p>
                <p className="mt-1 text-[0.7rem] text-muted-foreground line-clamp-4">{r.Report_Description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CounterReportView({ report, reportId, year }: { report: any; reportId: ReportId; year: number }) {
  const header = report.Report_Header;
  const items = report.Report_Items || [];

  // For PR (platform report), there's typically 1 Report_Item representing the whole platform.
  // For TR, items are journals. For IR, items are individual articles.
  return (
    <div className="space-y-4">
      {/* Report header */}
      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetaItem label="Report ID" value={header?.Report_ID} />
          <MetaItem label="Customer ID" value={header?.Customer_ID} />
          <MetaItem label="Release" value={header?.Release} />
          <MetaItem label="Created" value={header?.Created ? new Date(header.Created).toLocaleString() : "—"} />
          <MetaItem label="Begin date" value={header?.Reporting_Period?.Begin_Date} />
          <MetaItem label="End date" value={header?.Reporting_Period?.End_Date} />
          <MetaItem label="Institution" value={header?.Institution_Name} />
          <MetaItem label="Items in report" value={String(items.length)} />
        </div>
      </div>

      {/* Summary metrics */}
      <SummaryMetrics items={items} year={year} />

      {/* Items table */}
      <div>
        <p className="eyebrow mb-2">
          {reportId === "PR" ? "Platform performance" : reportId === "TR" ? "Titles" : "Items (articles)"}
        </p>
        <ScrollArea className="h-96 pr-3 epip-scroll">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                {reportId === "PR" && <th className="pb-2 pr-2 font-medium">Platform</th>}
                {reportId === "TR" && <th className="pb-2 pr-2 font-medium">Title</th>}
                {reportId === "IR" && <th className="pb-2 pr-2 font-medium">Article</th>}
                {reportId === "IR" && <th className="pb-2 pr-2 font-medium">DOI</th>}
                <th className="pb-2 pr-2 font-medium">Total Investigations</th>
                <th className="pb-2 pr-2 font-medium">Total Requests</th>
                <th className="pb-2 pr-2 font-medium">Unique Investigations</th>
                <th className="pb-2 pr-2 font-medium">Unique Requests</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => {
                const totals = sumPerformance(item.Performance);
                return (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-2 max-w-xs truncate">
                      {reportId === "PR" ? item.Platform : reportId === "TR" ? item.Title : item.Title}
                    </td>
                    {reportId === "IR" && (
                      <td className="py-2 pr-2 font-mono text-[0.65rem]">
                        {item.DOI?.[0] || "—"}
                      </td>
                    )}
                    <td className="py-2 pr-2 font-mono">{totals.Total_Item_Investigations.toLocaleString()}</td>
                    <td className="py-2 pr-2 font-mono">{totals.Total_Item_Requests.toLocaleString()}</td>
                    <td className="py-2 pr-2 font-mono">{totals.Unique_Item_Investigations.toLocaleString()}</td>
                    <td className="py-2 pr-2 font-mono">{totals.Unique_Item_Requests.toLocaleString()}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={reportId === "IR" ? 6 : 5} className="py-6 text-center text-muted-foreground">
                    No items in this report for the selected year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </ScrollArea>
      </div>

      <p className="text-[0.65rem] text-muted-foreground">
        These metrics are derived from article view and download counts. In production they
        would be sourced from a real usage-tracking pipeline (e.g. Matomo, GA4, or a custom
        event log) that records each request to a pre-signed galley URL.
      </p>
    </div>
  );
}

function sumPerformance(performance: any[]): {
  Total_Item_Investigations: number;
  Total_Item_Requests: number;
  Unique_Item_Investigations: number;
  Unique_Item_Requests: number;
} {
  const out = {
    Total_Item_Investigations: 0,
    Total_Item_Requests: 0,
    Unique_Item_Investigations: 0,
    Unique_Item_Requests: 0,
  };
  for (const metric of performance || []) {
    const key = metric.Metric_Type as keyof typeof out;
    if (key in out) {
      out[key] = (metric.Performance || []).reduce((s: number, p: any) => s + (p.Value || 0), 0);
    }
  }
  return out;
}

function MetaItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function SummaryMetrics({ items, year }: { items: any[]; year: number }) {
  const totals = items.reduce(
    (acc, item) => {
      const t = sumPerformance(item.Performance);
      acc.Total_Item_Investigations += t.Total_Item_Investigations;
      acc.Total_Item_Requests += t.Total_Item_Requests;
      acc.Unique_Item_Investigations += t.Unique_Item_Investigations;
      acc.Unique_Item_Requests += t.Unique_Item_Requests;
      return acc;
    },
    {
      Total_Item_Investigations: 0,
      Total_Item_Requests: 0,
      Unique_Item_Investigations: 0,
      Unique_Item_Requests: 0,
    }
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label="Total investigations" value={totals.Total_Item_Investigations.toLocaleString()} sub={`in ${year}`} />
      <SummaryCard label="Total requests" value={totals.Total_Item_Requests.toLocaleString()} sub={`PDF/HTML downloads`} />
      <SummaryCard label="Unique investigations" value={totals.Unique_Item_Investigations.toLocaleString()} sub={`distinct users`} />
      <SummaryCard label="Unique requests" value={totals.Unique_Item_Requests.toLocaleString()} sub={`distinct users`} />
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-4">
        <p className="font-display text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[0.65rem] text-muted-foreground/70">{sub}</p>
      </CardContent>
    </Card>
  );
}
