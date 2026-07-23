"use client";

// ---------------------------------------------------------------------------
// DataTableChart — always shows the real table extracted from an
// Article/MagazinePiece/MediaPost's body (src/lib/data-tables.ts); layers a
// Plotly.js chart on top only when the table has a genuine numeric column
// with enough rows to be meaningful (isChartable()) — never a chart with
// invented data. Every table, chartable or not, gets 1-click CSV/Excel
// export (src/lib/table-export.ts) since exporting doesn't require any
// numeric structure.
// ---------------------------------------------------------------------------

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Data } from "plotly.js";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportTableToCsv, exportTableToExcel } from "@/lib/table-export";

const PlotlyChart = dynamic(() => import("./plotly-chart").then((m) => m.PlotlyChart), {
  ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">Loading chart…</div>,
});

export interface DataTableChartTable {
  headers: string[];
  rows: string[][];
  numericColumns: number[];
  chartable: boolean;
}

const CHART_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "scatter", label: "Scatter" },
] as const;
type ChartType = (typeof CHART_TYPES)[number]["value"];

function toNumber(cell: string | undefined): number {
  const raw = (cell || "").replace(/[$,%\s]/g, "");
  return raw && !isNaN(Number(raw)) ? Number(raw) : 0;
}

export function DataTableChart({ table, filenameBase }: { table: DataTableChartTable; filenameBase: string }) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [exporting, setExporting] = useState(false);

  const labelCol = table.headers.findIndex((_, i) => !table.numericColumns.includes(i));
  const labels = table.rows.map((row, i) => (labelCol >= 0 ? row[labelCol] || `Row ${i + 1}` : `Row ${i + 1}`));

  const plotData: Data[] = table.numericColumns.map((col) => ({
    x: labels,
    y: table.rows.map((row) => toNumber(row[col])),
    name: table.headers[col] || `Column ${col + 1}`,
    type: chartType === "bar" ? "bar" : "scatter",
    mode: chartType === "line" ? "lines+markers" : chartType === "scatter" ? "markers" : undefined,
  }));

  async function handleExport(kind: "csv" | "excel") {
    setExporting(true);
    try {
      if (kind === "csv") await exportTableToCsv(table, filenameBase);
      else await exportTableToExcel(table, filenameBase);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport("csv")}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
        </Button>
        <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Export Excel
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="border border-border bg-muted/50 p-1.5 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={j} className="border border-border p-1.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.chartable && (
        <div className="mt-4">
          <div className="mb-2 flex justify-end">
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="h-72">
            <PlotlyChart data={plotData} />
          </div>
        </div>
      )}
    </div>
  );
}
