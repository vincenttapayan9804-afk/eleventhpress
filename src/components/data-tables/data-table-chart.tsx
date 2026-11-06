"use client";

// ---------------------------------------------------------------------------
// DataTableChart — always shows the real table extracted from an
// Article/MagazinePiece/MediaPost's body (src/lib/data-tables.ts); layers a
// Plotly.js chart on top only when the table has a genuine numeric column
// with enough rows to be meaningful (isChartable()) — never a chart with
// invented data. Every table, chartable or not, gets 1-click CSV/Excel
// export (src/lib/table-export.ts) since exporting doesn't require any
// numeric structure. Charts are laid out by src/lib/data-table-plot.ts so
// labels, ticks and legend never overlap; articles also get a branded PDF.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportTableToCsv, exportTableToExcel } from "@/lib/table-export";
import { buildPlot, MAX_SERIES, type ChartType } from "@/lib/data-table-plot";

const PlotlyChart = dynamic(() => import("./plotly-chart").then((m) => m.PlotlyChart), {
  ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">Loading chart…</div>,
});

export interface DataTableChartTable {
  headers: string[];
  rows: string[][];
  numericColumns: number[];
  chartable: boolean;
  sectionRows?: number[];
  labelColumn?: number;
  caption?: string;
}

const CHART_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "scatter", label: "Scatter" },
] as const;

/** Tracks the chart container's width so the layout can adapt (fewer,
 * steeper ticks and a two-column legend on phones). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function DataTableChart({
  table,
  filenameBase,
  pdfHref,
}: {
  table: DataTableChartTable;
  filenameBase: string;
  /** Server-rendered, journal-branded PDF of this table (articles only). */
  pdfHref?: string;
}) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [exporting, setExporting] = useState(false);
  const { resolvedTheme } = useTheme();
  const [chartRef, chartWidth] = useWidth<HTMLDivElement>();
  const sections = useMemo(() => new Set(table.sectionRows ?? []), [table.sectionRows]);

  // Width is bucketed so a resize doesn't rebuild the figure on every pixel.
  const widthBucket = chartWidth < 520 ? 400 : 800;
  const plot = useMemo(
    () => (table.chartable ? buildPlot(table, chartType, { dark: resolvedTheme === "dark", width: widthBucket }) : null),
    [table, chartType, resolvedTheme, widthBucket]
  );

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
        {pdfHref && (
          <Button size="sm" variant="outline" asChild>
            <a href={pdfHref} download>
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Export PDF
            </a>
          </Button>
        )}
      </div>

      {table.caption && <p className="mb-2 text-xs font-medium text-foreground/80">{table.caption}</p>}

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
              <tr key={i} className={sections.has(i) ? "bg-muted/50 font-semibold" : undefined}>
                {row.map((c, j) => (
                  <td key={j} className="border border-border p-1.5 align-top">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plot && plot.data.length > 0 && (
        <div className="mt-4" ref={chartRef}>
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
          {table.numericColumns.length > MAX_SERIES && (
            <p className="mb-1 text-[11px] text-muted-foreground">
              Showing the first {MAX_SERIES} of {table.numericColumns.length} numeric columns; export the table for all of them.
            </p>
          )}
          <div style={{ height: plot.height }}>
            <PlotlyChart data={plot.data} layout={plot.layout} />
          </div>
        </div>
      )}
    </div>
  );
}
